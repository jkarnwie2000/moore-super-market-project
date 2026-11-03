const mongoose = require('mongoose');

// Records Stripe webhook event IDs so retried deliveries are only processed once.
const processedEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    type: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProcessedEvent', processedEventSchema);
