package kots

import (
	"fmt"
	"net"
	"net/http"
	"time"

	//lint:ignore ST1001 since Ginkgo and Gomega are DSLs this makes the tests more natural to read
	. "github.com/onsi/gomega"
	"github.com/onsi/gomega/gexec"
	"github.com/pkg/errors"
	"github.com/replicatedhq/kots/e2e/testim/inventory"
	"github.com/replicatedhq/kots/e2e/util"
)

type Installer struct {
	imageRegistry  string
	imageNamespace string
	imageTag       string
}

func NewInstaller(imageRegistry, imageNamespace, imageTag string) *Installer {
	return &Installer{
		imageRegistry:  imageRegistry,
		imageNamespace: imageNamespace,
		imageTag:       imageTag,
	}
}

func (i *Installer) Install(kubeconfig string, test inventory.Test) string {
	session, err := i.install(kubeconfig, test.UpstreamURI, test.Namespace)
	Expect(err).WithOffset(1).Should(Succeed(), "kots install")
	Eventually(session).WithOffset(1).WithTimeout(2*time.Minute).Should(gexec.Exit(0), "kots install")

	port, err := i.adminConsolePortForward(kubeconfig, test.Namespace)
	Expect(err).WithOffset(1).Should(Succeed(), "port forward")
	return port
}

func (i *Installer) install(kubeconfig, upstreamURI, namespace string) (*gexec.Session, error) {
	installPort, err := getFreePort()
	if err != nil {
		return nil, errors.Wrap(err, "get free port")
	}

	return util.RunCommand(
		"kots",
		"install", upstreamURI,
		fmt.Sprintf("--kubeconfig=%s", kubeconfig),
		"--no-port-forward",
		fmt.Sprintf("--port=%s", installPort),
		fmt.Sprintf("--namespace=%s", namespace),
		"--shared-password=password",
		fmt.Sprintf("--kotsadm-registry=%s", i.imageRegistry),
		fmt.Sprintf("--kotsadm-namespace=%s", i.imageNamespace),
		fmt.Sprintf("--kotsadm-tag=%s", i.imageTag),
	)
}

func (i *Installer) adminConsolePortForward(kubeconfig, namespace string) (string, error) {
	adminConsolePort, err := getFreePort()
	if err != nil {
		return adminConsolePort, errors.Wrap(err, "get free port")
	}

	url := fmt.Sprintf("http://localhost:%s", adminConsolePort)

	go func() {
		_, err := util.RunCommand(
			"kots",
			"admin-console",
			fmt.Sprintf("--kubeconfig=%s", kubeconfig),
			fmt.Sprintf("--namespace=%s", namespace),
			fmt.Sprintf("--port=%s", adminConsolePort),
		)
		Expect(err).WithOffset(1).Should(Succeed(), "async port forward")
	}()

	for i := 1; ; i++ {
		_, err := http.Get(fmt.Sprintf("%s/api/v1/ping", url))
		if err == nil {
			break
		}
		if i == 10 {
			return adminConsolePort, errors.Wrap(err, "api ping")
		}
		time.Sleep(2 * time.Second)
	}

	return adminConsolePort, nil
}

func getFreePort() (string, error) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return "", err
	}
	ln.Close()
	_, port, err := net.SplitHostPort(ln.Addr().String())
	return port, err
}
