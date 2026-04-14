function generer() {
  let code = "";
  for (let i = 0; i < 4; i++) { // Code a 4 chiffres
    code += Math.floor(Math.random() * 10);
  }
  document.getElementById("code").textContent = code;
}
