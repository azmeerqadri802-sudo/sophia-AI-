const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    image: { type: String, default: '' },
    API_Key: { type: String, required: false, select: false }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Team || mongoose.model('Team', TeamSchema);