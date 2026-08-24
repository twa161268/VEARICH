const bcrypt = require('bcrypt');
(async () => {
  const hash = await bcrypt.hash('sifa', 10);
  console.log(hash);
})();
