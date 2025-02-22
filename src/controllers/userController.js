const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const sgMail = require("@sendgrid/mail");

require("dotenv").config();
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const registerUser = async (req, res) => {
  // #swagger.tags = ['Auth']
  // #swagger.description = 'Endpoint to register a new user'
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      email,
      password: hashedPassword,
    });

    const user = await User.findOne({ email });

    // TODO Mover ésto a una función aparte
    const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = await bcrypt.hash(rawCode, 10);

    user.verificationCode = hashedCode;
    await user.save();

    const msg = {
      to: user.email,
      from: process.env.SENDGRID_EMAIL_ACCOUNT,
      subject: "Email de verificación",
      html: `<strong>Este es tu código de verificación: ${rawCode}</strong>`, // TODO Usar una template para éste email
    };

    sgMail
      .send(msg)
      .then(() => {
        console.log("Email sent");
      })
      .catch((error) => {
        console.error(error);
      });

    res.status(201).json({
      message: "User created successfully",
      user: { email: newUser.email },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const loginUser = async (req, res) => {
  // #swagger.tags = ['Auth']
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User doesn't exists" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (isPasswordValid) {
      const token = jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      res.status(200).json({ message: "Login successfull", token });
    } else {
      res.status(400).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyUser = async () => {
  // #swagger.tags = ['Auth']
  try {
    const { email, verificationCode } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User doesn't exist" });
    }
    if (user.verified) {
      return res.status(400).json({ message: "User already verified" });
    }

    const isCodeValid = bcrypt.compare(verificationCode, user.verificationCode);
    if (isCodeValid) {
      user.verified = true;
      user.verificationCode = null;
      await user.save();
      res.status(200).json({ message: "User verified successfully" });
    } else {
      res.status(400).json({ message: "Invalid verification code" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const forgotPassword = async (req, res) => {
  // #swagger.tags = ['Auth']
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User doesn't exist" });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Here you would send the token to the user's email
    // For example, using a mail service like SendGrid or Nodemailer

    res.status(200).json({ message: "Password reset link sent", token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const resetPassword = async (req, res) => {
  // #swagger.tags = ['Auth']
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: "Token and new password are required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(400).json({ message: "Invalid token" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  verifyUser,
  forgotPassword,
  resetPassword,
};
