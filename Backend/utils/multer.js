const multer = require('multer');

// Use memory storage — file is kept as a buffer and streamed directly to Cloudinary
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv',
        'application/zip',
        'application/x-zip-compressed'
    ];

    if (
        file.mimetype.startsWith('image/') || 
        file.mimetype.startsWith('video/') || 
        allowedMimeTypes.includes(file.mimetype)
    ) {
        cb(null, true);
    } else {
        cb(new Error('Unsupported file format! Only images, videos, PDFs, and standard documents are allowed.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max to support research papers & documents comfortably
});

module.exports = upload;
