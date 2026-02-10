const express = require("express");
const router = express.Router();

const { register, login } = require("../controllers/authController");
const { googleLogin } = require('../controllers/googleAuthController')

router.get("/test", (req, res) => {
  res.json({ message: "Auth route working" });
});

router.post("/register", register);
router.post("/login", login);
router.post('/google', googleLogin)

module.exports = router;