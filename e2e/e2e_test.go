package e2e

import (
	"flag"
	"os"
	"testing"

	//lint:ignore ST1001 since Ginkgo and Gomega are DSLs this makes the tests more natural to read
	. "github.com/onsi/ginkgo/v2"
	//lint:ignore ST1001 since Ginkgo and Gomega are DSLs this makes the tests more natural to read
	. "github.com/onsi/gomega"
	"github.com/replicatedhq/kots/e2e/cluster"
	"github.com/replicatedhq/kots/e2e/helm"
	"github.com/replicatedhq/kots/e2e/kots"
	"github.com/replicatedhq/kots/e2e/kubectl"
	"github.com/replicatedhq/kots/e2e/minio"
	"github.com/replicatedhq/kots/e2e/testim"
	"github.com/replicatedhq/kots/e2e/testim/inventory"
	"github.com/replicatedhq/kots/e2e/util"
	"github.com/replicatedhq/kots/e2e/velero"
	"github.com/replicatedhq/kots/e2e/workspace"
)

var testimClient *testim.Client
var helmCLI *helm.CLI
var veleroCLI *velero.CLI
var kotsInstaller *kots.Installer

var (
	testimBranch          string
	skipTeardown          bool
	existingKubeconfig    string
	kotsadmImageRegistry  string
	kotsadmImageNamespace string
	kotsadmImageTag       string
)

func init() {
	flag.StringVar(&testimBranch, "testim-branch", "master", "testim branch to use")
	flag.StringVar(&existingKubeconfig, "existing-kubeconfig", "", "use kubeconfig from existing cluster, do not create clusters (only for use with targeted testing)")
	flag.BoolVar(&skipTeardown, "skip-teardown", false, "do not tear down clusters")
	flag.StringVar(&kotsadmImageRegistry, "kotsadm-image-registry", "", "override the kotsadm images registry")
	flag.StringVar(&kotsadmImageNamespace, "kotsadm-image-namespace", "", "override the kotsadm images registry namespace")
	flag.StringVar(&kotsadmImageTag, "kotsadm-image-tag", "v0.0.0-nightly", "override the kotsadm images tag")
}

func TestE2E(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "E2E Suite")
}

var _ = BeforeSuite(func() {
	testimAccessToken := os.Getenv("TESTIM_ACCESS_TOKEN")
	Expect(testimAccessToken).ShouldNot(BeEmpty(), "TESTIM_ACCESS_TOKEN required")

	Expect(util.CommandExists("kubectl")).To(BeTrue(), "kubectl required") // TODO
	Expect(util.CommandExists("helm")).To(BeTrue(), "helm required")       // TODO
	Expect(util.CommandExists("velero")).To(BeTrue(), "velero required")   // TODO
	Expect(util.CommandExists("testim")).To(BeTrue(), "testim required")   // TODO
	Expect(util.CommandExists("kots")).To(BeTrue(), "kots required")       // TODO

	w := workspace.New()
	DeferCleanup(w.Teardown)

	testimClient = testim.NewClient(
		testimAccessToken,
		util.EnvOrDefault("TESTIM_PROJECT_ID", "wpYAooUimFDgQxY73r17"),
		"Testim-grid",
		testimBranch,
	)

	helmCLI = helm.NewCLI(w.GetDir())

	veleroCLI = velero.NewCLI(w.GetDir())

	kotsInstaller = kots.NewInstaller(kotsadmImageRegistry, kotsadmImageNamespace, kotsadmImageTag)
})

var _ = Describe("E2E", func() {

	var w workspace.Workspace

	BeforeEach(func() {
		w = workspace.New()
		if !skipTeardown {
			DeferCleanup(w.Teardown)
		}
	})

	Context("with an online cluster", func() {

		var c cluster.Interface
		var kubectlCLI *kubectl.CLI

		BeforeEach(func() {
			if existingKubeconfig != "" {
				c = cluster.NewExisting(existingKubeconfig)
			} else {
				// kind := cluster.NewKind(w.GetDir())
				// DeferCleanup(kind.PrintDebugInfo)
				// c = kind

				k3d := cluster.NewK3d(w.GetDir())
				DeferCleanup(k3d.PrintDebugInfo)
				c = k3d
			}
			if !skipTeardown {
				DeferCleanup(c.Teardown)
			}

			kubectlCLI = kubectl.NewCLI(w.GetDir(), c.GetKubeconfig())
		})

		AfterEach(func() {
			// Debug
			// TODO: run this on failure
			if kubectlCLI != nil {
				kubectlCLI.GetAllPods()
			}
		})

		DescribeTable(
			"install kots and run the test",
			func(test inventory.Test) {

				if test.NeedsSnapshots {
					GinkgoWriter.Println("Installing Minio")

					minio := minio.New(minio.Options{})
					minio.Install(helmCLI, c.GetKubeconfig())

					GinkgoWriter.Println("Installing Velero")

					veleroCLI.Install(w.GetDir(), c.GetKubeconfig(), minio)
				}

				GinkgoWriter.Println("Installing KOTS")
				adminConsolePort := kotsInstaller.Install(c.GetKubeconfig(), test)

				GinkgoWriter.Println("Running E2E tests")
				testimClient.Run(test, adminConsolePort)

			},
			func(test inventory.Test) string {
				return test.Name
			},
			Entry(nil, inventory.NewSmokeTest()),
			Entry(nil, inventory.NewChangeLicense()),
		)

	})

})
