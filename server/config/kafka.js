const { Kafka } = require('kafkajs');

const enabled = process.env.KAFKA_ENABLED === 'true';
const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const clientId = process.env.KAFKA_CLIENT_ID || 'zialabs-ai-client';

let kafka = null;
let producer = null;
let isFallback = !enabled;

if (enabled) {
  try {
    kafka = new Kafka({
      clientId,
      brokers,
      retry: {
        retries: 2
      }
    });
    producer = kafka.producer();
  } catch (err) {
    console.error('Kafka client init failed, falling back to mock logger:', err.message);
    isFallback = true;
  }
} else {
  console.log('Kafka is disabled. Running in local event-logger fallback mode.');
}

async function initProducer() {
  if (isFallback) {
    console.log('ℹ️ [Event Broker] Mock event-logger activated.');
    return;
  }
  
  try {
    console.log(`🔌 Connecting to Kafka broker at ${brokers.join(', ')}...`);
    await producer.connect();
    console.log('✅ Connected to Apache Kafka Broker successfully!');
  } catch (err) {
    console.warn(`⚠️ Kafka broker unreachable: ${err.message}. Falling back to local event-logger.`);
    isFallback = true;
  }
}

async function publishEvent(topic, messageObj) {
  const payload = {
    ...messageObj,
    timestamp: new Date().toISOString()
  };
  
  const payloadStr = JSON.stringify(payload);

  if (isFallback) {
    console.log(`📢 [Mock Event Stream] [Topic: ${topic}]:`, payloadStr);
    return;
  }

  try {
    await producer.send({
      topic,
      messages: [
        { value: payloadStr }
      ]
    });
    console.log(`📡 [Kafka Stream] [Topic: ${topic}] Event sent successfully.`);
  } catch (err) {
    console.error(`❌ Failed to publish event to topic ${topic}:`, err.message);
    console.log(`📢 [Local Log Fallback] [Topic: ${topic}]:`, payloadStr);
  }
}

async function disconnectProducer() {
  if (producer && !isFallback) {
    try {
      await producer.disconnect();
      console.log('🔌 Disconnected Kafka producer.');
    } catch (err) {
      console.error('Failed to disconnect Kafka producer:', err.message);
    }
  }
}

module.exports = {
  kafka,
  initProducer,
  publishEvent,
  disconnectProducer,
  isEnabled: () => !isFallback
};
