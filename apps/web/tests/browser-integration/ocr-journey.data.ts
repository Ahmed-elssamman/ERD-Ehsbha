/** Valid synthetic PNG; recognition output is supplied by the isolated API fixture. */
export const journeyImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAMUlEQVRIie3QMQ0AAAjAMPybBgm7+FoDSzb7bASKRcmiZFGyKFmULEoWJYuSRel90QGLVfSmL9cHVAAAAABJRU5ErkJggg==', 'base64');

export const journeyFields = [
  { label: 'Quoted price', value: '100' },
  { label: 'Commission', value: '15' },
  { label: 'Received', value: '85' },
  { label: 'Total km', value: '10' },
  { label: 'Paid distance', value: '10' },
  { label: 'Started at', value: '2026-09-16T17:00' },
  { label: 'End time', value: '2026-09-16T17:20' },
  { label: 'Duration (seconds)', value: '1200' },
  { label: 'Pickup', value: 'Test pickup' },
];
