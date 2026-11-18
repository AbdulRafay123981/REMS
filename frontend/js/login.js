const form = document.querySelector("#login-form");
const errorBox = document.querySelector("#login-error");
const submitButton = document.querySelector("#login-submit");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  errorBox.textContent = "";
  submitButton.disabled = true;
  submitButton.textContent = "Signing in...";

  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;

  try {
    const user = await REMSApi.post("/api/login", {
      email,
      password,
    });

    await REMSAuth.refresh();

    errorBox.textContent = `Welcome back, ${user.name}!`;
    errorBox.style.color = "green";
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.style.color = "";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Sign In";
  }
});
