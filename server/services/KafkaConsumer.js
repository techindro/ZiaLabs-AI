const { kafka, isEnabled } = require('../config/kafka');

let consumer = null;

async function startConsumer() {
  if (!isEnabled() || !kafka) {
    console.log('ℹ️ [Kafka Consumer] Consumer offline (mock fallback active).');
    return;
  }

  try {
    consumer = kafka.consumer({ groupId: 'zialabs-ai-group' });
    console.log('🔌 Connecting Kafka consumer...');
    await consumer.connect();
    
    // Subscribe to analytics topics
    await consumer.subscribe({ topic: 'user-activity', fromBeginning: false });
    await consumer.subscribe({ topic: 'search-queries', fromBeginning: false });
    await consumer.subscribe({ topic: 'ai-synthesis', fromBeginning: false });
    
    console.log('✅ Kafka Consumer subscribed to analytics topics.');

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const val = message.value.toString();
        console.log(`📥 [Kafka Consumer Alert] [Topic: ${topic}] Partition: ${partition}:`, val);
      }
    });
  } catch (err) {
    console.error('❌ Kafka Consumer initialization failed:', err.message);
  }
}

async function stopConsumer() {
  if (consumer && isEnabled()) {
    try {
      await consumer.disconnect();
      console.log('🔌 Disconnected Kafka consumer.');
    } catch (err) {
      console.error('Failed to disconnect Kafka consumer:', err.message);
    }
  }
}

module.exports = {
  startConsumer,
  stopConsumer
};
