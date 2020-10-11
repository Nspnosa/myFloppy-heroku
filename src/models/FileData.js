const mongoose = require('mongoose');

const FileDataSchema = mongoose.Schema({
  fileID: { required: true, type: String },
  fileData: { required: true, type: Buffer },
});

module.exports = mongoose.model('FileData', FileDataSchema);
