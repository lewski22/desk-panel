if (process.env.VITE_DEMO_MODE === 'true') {
  console.error('ERROR: VITE_DEMO_MODE=true blocks production build');
  process.exit(1);
}
