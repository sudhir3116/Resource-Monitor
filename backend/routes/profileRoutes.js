const express = require('express')
const router = express.Router()
const auth = require('../middleware/authMiddleware')
const User = require('../models/User')
const bcrypt = require('bcryptjs')

// GET /api/profile - returns authenticated user's profile
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password')
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json({ user })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/profile - update profile details
router.put('/', auth, async (req, res) => {
  try {
    const { name, avatar } = req.body

    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ message: 'User not found' })

    if (name) user.name = name
    if (avatar) user.avatar = avatar // Stores URL

    await user.save()

    // Return updated user without password
    const updatedUser = await User.findById(req.userId).select('-password')
    res.json({ user: updatedUser, message: 'Profile updated successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/profile/password - change password
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both passwords required' })

    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ message: 'User not found' })

    const match = await bcrypt.compare(currentPassword, user.password)
    if (!match) return res.status(401).json({ message: 'Current password incorrect' })

    const hashed = await bcrypt.hash(newPassword, 10)
    user.password = hashed
    await user.save()
    res.json({ message: 'Password changed' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router

