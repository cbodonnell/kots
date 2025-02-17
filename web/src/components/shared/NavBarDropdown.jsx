import React from "react";
import { useHistory } from "react-router-dom";
import Icon from "../Icon";
import ChangePasswordModal from "../modals/ChangePasswordModal/ChangePasswordModal";

const NavBarDropdown = ({ handleLogOut, isHelmManaged }) => {
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [showModal, setShowModal] = React.useState(false);
  const testRef = React.useRef(null);
  const history = useHistory();

  const closeModal = () => {
    setShowModal(false);
  };

  const handleBlur = (e) => {
    // if the clicked item is inside the dropdown
    if (e.currentTarget.contains(e.relatedTarget)) {
      // do nothing
      return;
    }
    setShowDropdown(false);
  };

  const handleNav = (e) => {
    // manually triggers nav because blur event happens too fast otherwise
    history.push("/upload-license");
    setShowDropdown(false);
  };

  React.useEffect(() => {
    // focus the dropdown when open so when clicked outside,
    // the onBlur event triggers and closes the dropdown
    if (showDropdown) {
      testRef.current.focus();
    }
  }, [showDropdown]);

  return (
    <div className="navbar-dropdown-container">
      <span tabIndex={0} onClick={() => setShowDropdown(!showDropdown)}>
        <Icon icon="more-circle-outline" size={20} className="gray-color" />
      </span>
      <ul
        ref={testRef}
        tabIndex={0}
        onBlur={handleBlur}
        className={`dropdown-nav-menu ${showDropdown ? "" : "hidden"}`}
      >
        <li>
          <p onClick={() => setShowModal(true)}>Change password</p>
        </li>
        {!isHelmManaged && (
          <li onMouseDown={handleNav}>
            <p>Add new application</p>
          </li>
        )}
        <li>
          <p data-qa="Navbar--logOutButton" onClick={handleLogOut}>
            Log out
          </p>
        </li>
      </ul>
      <ChangePasswordModal isOpen={showModal} closeModal={closeModal} />
    </div>
  );
};

export default NavBarDropdown;
