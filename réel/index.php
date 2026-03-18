<!DOCTYPE html>
<html>
<body>
  <!-- ton HTML PHP ici -->
  <?php echo "Bonjour " . $user; ?>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io('http://localhost:3000');

    socket.on('connect', () => {
      console.log('Connecté :', socket.id);
    });

    socket.on('message', (data) => {
      console.log(data);
    });
  </script>
</body>
</html>