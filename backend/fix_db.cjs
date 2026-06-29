const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://devpot076_db_user:YIrtY0KIkVV89TP8@cluster0.yajfcg3.mongodb.net/grhapoch').then(async () => {
    const products = mongoose.connection.collection('products');
    const pId = new mongoose.Types.ObjectId('6a3bcfba6c238e9831c42bc2');
    const vId = new mongoose.Types.ObjectId('6a3bcfba6c238e9831c42bc3');
    
    const res = await products.updateOne(
        { _id: pId, 'variants._id': vId },
        { $set: { 
            averageRating: 5, 
            totalReviews: 1,
            'ratingDistribution.5': 1,
            'variants.$.averageRating': 5, 
            'variants.$.totalReviews': 1,
            'variants.$.ratingDistribution.5': 1
        } }
    );
    console.log('Update result:', res);
    mongoose.disconnect();
}).catch(console.error);
