const { date, string } = require('joi');
const mongoose = require('mongoose');

const FileSchema = mongoose.Schema({
  name: { required: true, type: String },
  size: { required: true, type: Number },
  'upload-date': { required: true, type: Date, default: Date.now() },
  owner: { required: true, type: String },
  fileData: { required: true, type: String },
});

module.exports = mongoose.model('File', FileSchema);
