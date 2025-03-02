import axios from "axios";

// Backend URL
const SERVER_URL = "https://quality-visually-stinkbug.ngrok-free.app";

async function callSignup() {
  // 1) Get input elements
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");

  // 2) Check if elements exist
  if (!emailInput || !passwordInput) {
    console.error("Missing #email or #password element in HTML");
    alert("Error: Email or password field is missing.");
    return;
  }

  // 3) Extract values
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  // 4) Validate inputs
  if (!email || !password) {
    alert("Please enter both email and password.");
    return;
  }

  try {
    // 5) Show loading message
    alert("Signing up... Please wait.");

    // 6) Send request using Axios
    const response = await axios.post(
      `${SERVER_URL}/api/auth/signup`,
      { email, password },
      { headers: { "Content-Type": "application/json" } }
    );

    // 7) Success response
    console.log("Signup successful:", response.data);
    alert("Signup successful!\n" + JSON.stringify(response.data, null, 2));
  } catch (error) {
    // 8) Handle errors
    console.error("Signup error:", error);
    const message =
      error.response?.data?.message || error.message || "Unknown error";
    alert(`Signup error: ${message}`);
  }
}

// Attach function globally (for debugging in console)
window.callSignup = callSignup;
