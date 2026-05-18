const cloudinary = require('../config/cloudinary.config');
const { Readable } = require('stream');

const uploadService = {
    // Generate a signed upload token for direct client-side upload to Cloudinary
    generateUploadSignature(type = 'profile') {
        const timestamp = Math.round(Date.now() / 1000);
        
        let folder = 'student-journal/profiles';
        let transformation = 'w_400,h_400,c_fill,g_face';

        if (type === 'background') {
            folder = 'student-journal/backgrounds';
            transformation = 'w_1920,h_1080,c_limit';
        } else if (type === 'attachment') {
            folder = 'student-journal/attachments';
            transformation = ''; // Keep original quality for attachments
        }

        const params = { timestamp, folder };
        if (transformation) params.transformation = transformation;

        const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);

        return {
            signature,
            timestamp,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
            apiKey: process.env.CLOUDINARY_API_KEY,
            folder: params.folder,
            transformation: params.transformation || '',
        };
    },

    // Generic server-side upload helper
    async uploadFile(file, folder = 'student-journal/attachments', resourceType = 'auto') {
        if (!file) return null;

        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder, resource_type: resourceType },
                (error, result) => {
                    if (error) return reject(error);
                    resolve({
                        url: result.secure_url,
                        public_id: result.public_id,
                        resource_type: result.resource_type
                    });
                }
            );

            const stream = Readable.from(file.buffer);
            stream.pipe(uploadStream);
        });
    },

    // Delete a file from Cloudinary by its public_id
    async deleteFile(publicId) {
        if (!publicId) return;
        try {
            await cloudinary.uploader.destroy(publicId);
        } catch (err) {
            console.error('Cloudinary delete error:', err.message);
        }
    }
};

module.exports = uploadService;
