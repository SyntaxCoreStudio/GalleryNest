const nodemailer = require("nodemailer");
const env = require("../config/env");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: env.emailUser,
    pass: env.emailPass,
  },
});

async function sendPasswordResetEmail(to, resetUrl) {
  await transporter.sendMail({
    from: `"GalleryNest" <${env.emailUser}>`,
    to,
    subject: "Reset your GalleryNest password",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Reset your password</h2>
        <p>You requested a password reset for your GalleryNest account.</p>
        <p>Click the link below to choose a new password:</p>
        <p>
          <a href="${resetUrl}">${resetUrl}</a>
        </p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

module.exports = {
  sendPasswordResetEmail,
};
