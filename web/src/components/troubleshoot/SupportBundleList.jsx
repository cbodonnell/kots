import * as React from "react";
import { KotsPageTitle } from "@components/Head";
import { Link } from "react-router-dom";
import { withRouter } from "@src/utilities/react-router-utilities";

import Toggle from "../shared/Toggle";
import Loader from "../shared/Loader";
import SupportBundleRow from "./SupportBundleRow";
import GenerateSupportBundle from "./GenerateSupportBundle";
import ConfigureRedactorsModal from "./ConfigureRedactorsModal";
import ErrorModal from "../modals/ErrorModal";
import { Utilities } from "../../utilities/utilities";
import { Repeater } from "@src/utilities/repeater";

import "../../scss/components/troubleshoot/SupportBundleList.scss";
import Icon from "../Icon";
import ReactTooltip from "react-tooltip";

class SupportBundleList extends React.Component {
  state = {
    supportBundles: [],
    errorMsg: "",
    displayRedactorModal: false,
    pollForBundleAnalysisProgress: new Repeater(),
    bundleAnalysisProgress: {},
    loadingSupportBundles: false,
    loadingBundleId: "",
  };

  componentDidMount() {
    this.listSupportBundles();
  }
  componentWillUnmount() {
    this.state.pollForBundleAnalysisProgress.stop();
  }
  componentDidUpdate(lastProps) {
    const { bundle } = this.props;
    if (
      bundle?.status !== "running" &&
      bundle?.status !== lastProps.bundle.status
    ) {
      this.state.pollForBundleAnalysisProgress.stop();
      if (bundle.status === "failed") {
        this.props.history.push(`/app/${this.props.watch.slug}/troubleshoot`);
      }
    }
  }

  listSupportBundles = () => {
    this.setState({
      errorMsg: "",
    });

    this.props.updateState({
      loading: true,
      displayErrorModal: true,
      loadingBundle: false,
    });

    fetch(
      `${process.env.API_ENDPOINT}/troubleshoot/app/${this.props.watch?.slug}/supportbundles`,
      {
        headers: {
          Authorization: Utilities.getToken(),
          "Content-Type": "application/json",
        },
        method: "GET",
      }
    )
      .then(async (res) => {
        if (!res.ok) {
          this.setState({
            errorMsg: `Unexpected status code: ${res.status}`,
          });
          this.props.updateState({ loading: false, displayErrorModal: true });
          return;
        }
        const response = await res.json();

        let bundleRunning = false;
        if (response.supportBundles) {
          bundleRunning = response.supportBundles.find(
            (bundle) => bundle.status === "running"
          );
        }
        if (bundleRunning) {
          this.state.pollForBundleAnalysisProgress.start(
            this.props.pollForBundleAnalysisProgress,
            1000
          );
        }
        this.setState({
          supportBundles: response.supportBundles,

          errorMsg: "",
        });
        this.props.updateState({ loading: false, displayErrorModal: false });
      })
      .catch((err) => {
        console.log(err);
        this.setState({
          errorMsg: err
            ? err.message
            : "Something went wrong, please try again.",
        });
        this.props.updateState({ displayErrorModal: true, loading: false });
      });
  };

  toggleErrorModal = () => {
    this.props.updateState({
      displayErrorModal: !this.props.displayErrorModal,
    });
  };

  toggleRedactorModal = () => {
    this.setState({
      displayRedactorModal: !this.state.displayRedactorModal,
    });
  };

  render() {
    const { watch, loading, loadingBundle } = this.props;
    const { errorMsg, supportBundles } = this.state;

    const appTitle = watch.watchName || watch.name;
    const downstream = watch.downstream;

    if (loading) {
      return (
        <div className="flex1 flex-column justifyContent--center alignItems--center">
          <Loader size="60" />
        </div>
      );
    }

    let bundlesNode;
    if (downstream) {
      if (supportBundles?.length) {
        bundlesNode = supportBundles
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .map((bundle) => (
            <SupportBundleRow
              key={bundle.id}
              bundle={bundle}
              watchSlug={watch.slug}
              isAirgap={watch.isAirgap}
              isSupportBundleUploadSupported={
                watch.isSupportBundleUploadSupported
              }
              refetchBundleList={this.listSupportBundles}
              progressData={
                this.props.loadingBundleId === bundle.id &&
                this.props.bundleProgress
              }
              loadingBundle={
                this.props.loadingBundleId === bundle.id &&
                this.props.loadingBundle
              }
            />
          ));
      } else {
        return (
          <GenerateSupportBundle
            watch={watch}
            updateBundleSlug={this.props.updateBundleSlug}
            bundle={this.props.bundle}
            pollForBundleAnalysisProgress={
              this.props.pollForBundleAnalysisProgress
            }
          />
        );
      }
    }

    return (
      <div className="centered-container u-paddingBottom--30 u-paddingTop--30 flex1 flex">
        <KotsPageTitle pageName="Version History" showAppSlug />
        <div className="flex1 flex-column">
          <div className="flex justifyContent--center u-paddingBottom--30">
            <Toggle
              items={[
                {
                  title: "Support bundles",
                  onClick: () =>
                    this.props.history.push(
                      `/app/${this.props.watch.slug}/troubleshoot`
                    ),
                  isActive: true,
                },
                {
                  title: "Redactors",
                  onClick: () =>
                    this.props.history.push(
                      `/app/${this.props.watch.slug}/troubleshoot/redactors`
                    ),
                  isActive: false,
                },
              ]}
            />
          </div>
          <div className="card-bg support-bundle-list-wrapper">
            <div className="flex flex1 flex-column">
              <div className="u-position--relative flex-auto u-paddingBottom--10 flex">
                <div className="flex flex1 u-flexTabletReflow">
                  <div className="flex flex1">
                    <div className="flex-auto alignSelf--center">
                      <p className="card-title">Support bundles</p>
                    </div>
                  </div>
                  <div className="RightNode flex-auto flex alignItems--center u-position--relative">
                    {loadingBundle ? (
                      <>
                        <p
                          className="replicated-link flex alignItems--center u-fontSize--small"
                          style={{
                            color: "gray",
                          }}
                          data-tip={
                            "Only one support bundle can be generated at a time."
                          }
                        >
                          <Icon
                            icon="tools"
                            size={18}
                            className="clickable u-marginRight--5"
                            style={{ color: "gray" }}
                          />
                          Generate a support bundle
                        </p>
                        <ReactTooltip
                          effect="solid"
                          className="replicated-tooltip"
                        />
                      </>
                    ) : (
                      <Link
                        to={`${this.props.match.url}/generate`}
                        className="replicated-link flex alignItems--center u-fontSize--small"
                      >
                        <Icon
                          icon="tools"
                          size={18}
                          className="clickable u-marginRight--5"
                        />
                        Generate a support bundle
                      </Link>
                    )}
                    <span
                      className="replicated-link flex alignItems--center u-fontSize--small u-marginLeft--20"
                      onClick={this.toggleRedactorModal}
                    >
                      <Icon
                        icon="marker-tip-outline"
                        size={18}
                        className="clickable u-marginRight--5"
                      />
                      Configure redaction
                    </span>
                  </div>
                </div>
              </div>
              <div
                className={`${
                  watch.downstream ? "flex1 flex-column u-overflow--auto" : ""
                }`}
              >
                {bundlesNode}
              </div>
            </div>
          </div>
        </div>
        {this.state.displayRedactorModal && (
          <ConfigureRedactorsModal onClose={this.toggleRedactorModal} />
        )}
        {errorMsg && (
          <ErrorModal
            errorModal={this.props.displayErrorModal}
            toggleErrorModal={this.toggleErrorModal}
            errMsg={errorMsg}
            tryAgain={this.listSupportBundles}
            err="Failed to get bundles"
            loading={this.props.loading}
            appSlug={this.props.match.params.slug}
          />
        )}
      </div>
    );
  }
}

export default withRouter(SupportBundleList);
