const form = document.querySelector("#register-form");
const errorBox = document.querySelector("#register-error");
const submitButton = document.querySelector("#register-submit");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  errorBox.textContent = "";

  const fullName = document.querySelector("#full-name").value.trim();
  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;
  const confirmPassword = document.querySelector("#confirm-password").value;

  if (password !== confirmPassword) {
    errorBox.textContent = "Passwords do not match";
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Creating Account...";

  try {
    await REMSApi.post("/api/register", {
      full_name: fullName,
      email,
      password,
    });

    await REMSAuth.refresh();
    window.location.assign("/properties");
  } catch (error) {
    errorBox.textContent = error.message;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Create Account";
  }
});
