require("dotenv").config();


const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const path = require("path");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const helmet = require("helmet");
const User = require("./models/user");
const Service = require("./models/Service");
const { auth, adminAuth } = require("./middleware/auth");
const imagesRouter = require("./routes/images");

const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Content Security Policy (CSP) with Helmet ---
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "https://*.mongodb.net", "https://gypsum-app.onrender.com"],
    },
  })
);

// --- Constants ---
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

// --- Nodemailer setup ---
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: ADMIN_EMAIL,
    pass: process.env.ADMIN_PASS, // Gmail App Password
  },
});

transporter.verify((error) => {
  if (error) {
    console.error("❌ Nodemailer error:", error);
  } else {
    console.log("✅ Nodemailer is ready to send emails");
  }
});

// --- Multer for image uploads ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// --- Generate JWT ---
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// --- CONTACT FORM ---
app.post("/api/contact", async (req, res) => {
  const { name, email, phone, postalCode, objectif, message } = req.body;

  if (!name || !email || !message) {
    return res
      .status(400)
      .json({ error: "Nom, e-mail et message sont obligatoires." });
  }

  try {
    const emailBody = `
💬 Nouveau message reçu depuis le formulaire :

👤 Nom complet : ${name}
📧 E-mail : ${email}
📞 Téléphone : ${phone || "Non renseigné"}
📮 Code postal : ${postalCode || "Non renseigné"}
🎯 Objectif : ${objectif || "Non renseigné"}

📝 Message :
${message}
`;

    await transporter.sendMail({
      from: `"Formulaire SuperStaff" <${ADMIN_EMAIL}>`,
      replyTo: email,
      to: ADMIN_EMAIL,
      subject: `📩 Nouveau contact de ${name}`,
      text: emailBody,
    });

    res.status(200).json({ success: true, message: "✅ Email envoyé avec succès" });
  } catch (error) {
    console.error("❌ Erreur lors de l'envoi de l'email :", error);
    res.status(500).json({ error: "Échec de l'envoi de l'email." });
  }
});

// --- SIGNUP ---
app.post("/api/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(409).json({ error: "Email already exists." });

    const user = new User({
      name,
      email,
      password,
      role: email === ADMIN_EMAIL ? "admin" : "user",
    });
    await user.save();

    const token = generateToken(user._id);
    res.status(201).json({
      success: true,
      message: "Signup successful.",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// --- LOGIN ---
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "User not found." });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: "Incorrect password." });

    const token = generateToken(user._id);
    res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// --- GET CURRENT USER ---
app.get("/api/auth/me", auth, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// --- FORGOT PASSWORD ---
app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required." });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found." });

    await transporter.sendMail({
      from: ADMIN_EMAIL,
      to: email,
      subject: "Reset Your Password",
      text: `Hello,\n\nHere is your password reset link: https://gypsum-app.onrender.com/reset\n\nBest regards`,
    });
    res.status(200).json({ message: "Reset link sent." });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ error: "Failed to send reset link." });
  }
});

// --- SERVICE ROUTES ---
app.get("/api/services", async (req, res) => {
  try {
    const services = await Service.find({ isActive: true });
    res.json({ success: true, services });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/services", adminAuth, upload.single("image"), async (req, res) => {
  try {
    const { title, description, link } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : "";

    if (!title || !description || !image) {
      return res
        .status(400)
        .json({ error: "Title, description and image are required." });
    }

    const service = new Service({
      title,
      description,
      image,
      link: link || "",
    });

    await service.save();
    res.status(201).json({ success: true, service });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.put("/api/services/:id", adminAuth, upload.single("image"), async (req, res) => {
  try {
    const { title, description, link } = req.body;
    const updateData = { title, description, link };
    if (req.file) updateData.image = `/uploads/${req.file.filename}`;

    const service = await Service.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });
    if (!service) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }
    res.json({ success: true, service });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.delete("/api/services/:id", adminAuth, async (req, res) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }
    res.json({ success: true, message: "Service deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// --- STATIC FILES ---
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/images", imagesRouter);


// --- CONNECT TO MONGODB AND START SERVER ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Atlas connected");
    const port = process.env.PORT || 5000;
    app.listen(port, () => console.log(`🚀 Backend running on port ${port}`));
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));