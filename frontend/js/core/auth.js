(() => {
  const who = document.querySelector("#who");
  const nav = document.querySelector("#mid");

  if (!who) return;

  let logoutButton = null;

  function showLoggedIn(user) {
    who.textContent = user.name;

    // Hide Sign In / Sign Up links.
    nav?.querySelectorAll('a[href="/login"], a[href="/register"]')
      .forEach((link) => {
        link.hidden = true;
      });

    if (!nav || logoutButton) return;

    logoutButton = document.createElement("button");
    logoutButton.type = "button";
    logoutButton.className = "pill";
    logoutButton.textContent = "Logout";

    logoutButton.addEventListener("click", async () => {
      logoutButton.disabled = true;

      try {
        await REMSApi.get("/api/logout");
        window.location.assign("/");
      } catch (error) {
        console.error("Logout failed:", error);
        logoutButton.disabled = false;
      }
    });

    nav.appendChild(logoutButton);
  }

  function showVisitor() {
    who.textContent = "Visitor";

    nav?.querySelectorAll('a[href="/login"], a[href="/register"]')
      .forEach((link) => {
        link.hidden = false;
      });

    logoutButton?.remove();
    logoutButton = null;
  }

  async function refresh() {
    try {
      const user = await REMSApi.get("/api/me");
      showLoggedIn(user);
      return user;
    } catch (error) {
      showVisitor();
      return null;
    }
  }

  window.REMSAuth = { refresh };

  refresh();
})();
