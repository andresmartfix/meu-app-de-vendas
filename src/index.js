import React from 'react';
import ReactDOM from 'react-dom';
import './index.css'; // Vamos criar este ficheiro no próximo passo
import App from './App'; // Vamos criar este ficheiro no próximo passo
import reportWebVitals from './reportWebVitals'; // Opcional, para medir performance

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

// Se quiser medir a performance da sua aplicação, passe uma função
// para registar resultados (ex: reportWebVitals(console.log))
// ou envie para um endpoint de análise. Saiba mais: https://bit.ly/CRA-vitals
reportWebVitals();