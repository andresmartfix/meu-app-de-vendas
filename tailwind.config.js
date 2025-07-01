/** @type {import('tailwindcss').Config} */
module.exports = {
  // A secção 'content' informa o Tailwind onde procurar as classes que você usa.
  // Ele analisará estes ficheiros para construir o seu CSS otimizado.
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // Inclui todos os ficheiros JavaScript/React na pasta src e subpastas
    "./public/index.html",       // Inclui o seu ficheiro HTML principal na pasta public
  ],
  theme: {
    // A secção 'extend' permite-lhe adicionar ou estender os temas padrão do Tailwind.
    // Por exemplo, pode adicionar novas cores, tamanhos de fonte, espaçamentos, etc.
    extend: {
      // Exemplo:
      // colors: {
      //   'custom-purple': '#8b5cf6',
      // },
      // spacing: {
      //   '128': '32rem',
      // },
    },
  },
  // A secção 'plugins' permite-lhe adicionar plugins do Tailwind CSS.
  // Estes plugins podem adicionar funcionalidades úteis, como formulários ou tipografia.
  plugins: [],
}