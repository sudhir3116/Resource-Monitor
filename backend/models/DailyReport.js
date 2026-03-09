const mongoose = require('mongoose');

const dailyReportSchema = new mongoose.Schema({
  warden: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  block: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Block',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: () => {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
  },
  // Resource check details
  resourceCheck: [{
    resource: String,
    checked: Boolean,
    currentReading: Number,
    notes: String
  }],
  
  // Overall report fields
  issues: {
    type: String,
    maxlength: 1000
  },
  studentsPresent: {
    type: Number,
    min: 0
  },
  maintenanceDone: {
    type: String,
    maxlength: 1000
  },
  overallStatus: {
    type: String,
    enum: ['NORMAL', 'ISSUES_FOUND', 'CRITICAL'],
    default: 'NORMAL'
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  
  // Admin review fields
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  adminNotes: {
    type: String,
    maxlength: 500
  }
}, { timestamps: true });

// Unique constraint: one report per warden per block per day
dailyReportSchema.index({ warden: 1, block: 1, date: 1 }, { unique: true });
dailyReportSchema.index({ block: 1, date: -1 });
dailyReportSchema.index({ warden: 1, date: -1 });
dailyReportSchema.index({ submittedAt: -1 });

module.exports = mongoose.model('DailyReport', dailyReportSchema);
