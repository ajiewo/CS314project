# Minimal Frontend

A minimal frontend project used for testing a [remote backend endpoint](https://quality-visually-stinkbug.ngrok-free.app). This setup uses [Vite](https://vitejs.dev/) for local development and includes a simple HTML page (`index.html`) and a JavaScript file (`main.js`) to call the backend signup endpoint using **Axios** for API requests.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [How It Works](#how-it-works)

## Prerequisites

Make sure you have the following installed on your machine:

- [Node.js](https://nodejs.org/) (LTS version recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)

## Project Structure

```bash
minimal-frontend/
│
├── index.html
├── main.js
├── package-lock.json
├── package.json
└── README.md
```

- **index.html**: A minimal HTML page with email/password inputs and a button to trigger the signup request.
- **main.js**: Contains the logic (`callSignup`) for sending the signup data to the remote backend.
- **package-lock.json**: Auto-generated file that locks dependency versions.
- **package.json**: Project metadata, scripts, and dependencies.
- **README.md**: Project documentation (this file).

## Installation

1. **Clone** the repository or download the source code.
2. **Navigate** to the project directory in your terminal.
3. **Install** dependencies:

   ```bash
   npm install
   ```

## Usage

1. Start the server:

   ```bash
   npm run dev
   ```

2. **Open** the URL provided by Vite (typically http://localhost:5173/) in your browser.

3. **Enter** your email and password in the form fields and click **Sign up**.

## Configuration

- By default, `main.js` points to:

  ```bash
  const SERVER_URL = "https://quality-visually-stinkbug.ngrok-free.app";
  ```

- The **CORS** configuration for the remote backend allow requests from the `port (5173)` where this frontend is served.

## How It Works

1. **index.html** defines:

   - Basic form fields for Email and Password.
   - A button that calls `callSignup()` from `main.js`.

2. **main.js** does the following:
   - Reads values from the email and password fields.
   - Sends a `POST` request to `[SERVER_URL]/api/auth/signup`.
   - Logs the results to the console and displays an alert indicating -whether signup was successful.
