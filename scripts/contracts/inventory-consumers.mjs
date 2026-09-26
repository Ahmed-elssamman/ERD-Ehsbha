import { extractApiConsumers } from '../verification/lib/extract-api-consumers.mjs';

const consumers = await extractApiConsumers();
const counts = consumers.reduce((result, consumer) => {
  result[consumer.application] = (result[consumer.application] || 0) + 1;
  return result;
}, {});

console.log(JSON.stringify({
  total: consumers.length,
  counts,
  consumers,
}, null, 2));
