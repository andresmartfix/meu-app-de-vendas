import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,     
  signOut                       
} from 'firebase/auth'; 
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, Timestamp, deleteDoc, doc } from 'firebase/firestore'; 
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList 
} from 'recharts';

// SmartFix Component for notifications
const SmartFix = ({ message, type, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (message) {
      setIsVisible(true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setIsVisible(false);
        onClose(); 
      }, 5000); 
    } else {
      setIsVisible(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [message, onClose]);

  if (!isVisible || !message) return null;

  let bgColorClass = '';
  let borderColorClass = '';
  let textColorClass = '';

  switch (type) {
    case 'info':
      bgColorClass = 'bg-blue-100';
      borderColorClass = 'border-blue-400';
      textColorClass = 'text-blue-700';
      break;
    case 'success':
      bgColorClass = 'bg-green-100';
      borderColorClass = 'border-green-400';
      textColorClass = 'text-green-700';
      break;
    case 'error':
      bgColorClass = 'bg-red-100';
      borderColorClass = 'border-red-400';
      textColorClass = 'text-red-700';
      break;
    case 'warning':
      bgColorClass = 'bg-yellow-100';
      borderColorClass = 'border-yellow-400';
      textColorClass = 'text-yellow-800';
      break;
    default:
      bgColorClass = 'bg-gray-100';
      borderColorClass = 'border-gray-400';
      textColorClass = 'text-gray-700';
  }

  return (
    <div
      className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg flex items-center justify-between z-50 transition-all duration-500 transform ${bgColorClass} ${borderColorClass} ${textColorClass} ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
      role="alert"
    >
      <span className="block sm:inline">{message}</span>
      <button onClick={() => setIsVisible(false)} className="ml-4 text-current opacity-75 hover:opacity-100 focus:outline-none">
        <svg className="h-4 w-4" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
};

// Componente da Janela Flutuante para Adicionar Venda Rápida
const FloatingSaleModal = ({ isOpen, onClose, onQuickAddSale, loading, showSmartFix }) => {
  const [amount, setAmount] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleAdd = async () => {
    if (amount === '' || isNaN(parseFloat(amount))) {
      showSmartFix('Por favor, insira um valor válido.', 'warning');
      return;
    }
    await onQuickAddSale(parseFloat(amount));
    setAmount(''); // Limpa o campo após adicionar
    onClose(); // Fecha o modal
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm">
        <h3 className="text-2xl font-bold text-purple-700 mb-4 text-center">Adicionar Venda Rápida</h3>
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          className="w-full p-3 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg shadow-sm mb-4"
          placeholder="Valor da Venda (hoje)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleAdd();
            }
          }}
        />
        <button
          onClick={handleAdd}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 active:scale-95 flex items-center justify-center text-lg mb-3"
          disabled={loading}
        >
          {loading ? 'Adicionando...' : 'Adicionar Venda'}
        </button>
        <button
          onClick={onClose}
          className="w-full text-gray-600 hover:text-gray-800 font-semibold py-2 px-4 rounded-lg transition duration-200"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};


function App() {
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [sales, setSales] = useState([]);
  const [newSaleAmount, setNewSaleAmount] = useState('');
  const [loading, setLoading] = useState(true);

  // SmartFix state
  const [smartFixMessage, setSmartFixMessage] = useState('');
  const [smartFixType, setSmartFixType] = useState('info');

  // New state variables for navigation and adding past sales
  const [viewMode, setViewMode] = useState('daily'); 
  const [displayDate, setDisplayDate] = useState(new Date()); 
  const [displayMonth, setDisplayMonth] = useState(new Date().getMonth()); 
  const [displayYear, setDisplayYear] = useState(new Date().getFullYear()); 

  const [selectedSaleDate, setSelectedSaleDate] = useState(new Date().toISOString().split('T')[0]);

  const saleInputRef = useRef(null);

  // PWA related state for "Add to Home Screen" prompt
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallMessage, setShowInstallMessage] = useState(false);

  // Auth states for email/password
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false); 
  const [authInstance, setAuthInstance] = useState(null); 

  // Estado para controlar a visibilidade da janela flutuante
  const [showFloatingSaleModal, setShowFloatingSaleModal] = useState(false);

  // Helper function to get the week number (ISO week date standard)
  function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); 
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
  }

  // Helper function to get the start of the week (Sunday)
  const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay(); 
    const diff = d.getDate() - day; 
    return new Date(d.getFullYear(), d.getMonth(), diff, 0, 0, 0, 0);
  };

  // Helper function to get the end of the week (Saturday)
  const getEndOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay(); 
    const diff = d.getDate() + (6 - day); 
    return new Date(d.getFullYear(), d.getMonth(), diff, 23, 59, 59, 999);
  };

  // Function to show SmartFix message
  const showSmartFix = (msg, type = 'info') => {
    setSmartFixMessage(msg);
    setSmartFixType(type);
  };

  // Initialize Firebase and set up authentication
  useEffect(() => {
    let unsubscribeAuthListener = () => {}; 

    const initializeFirebase = async () => {
      try {
        const firebaseConfig = {
          apiKey: "AIzaSyCYW9S1e3oMczYb96dPpGeEib71wG-mBVQ",
          authDomain: "vendas-da-loja.firebaseapp.com",
          projectId: "vendas-da-loja",
          storageBucket: "vendas-da-loja.firebasestorage.app",
          messagingSenderId: "88597692449",
          appId: "1:88597692449:web:1ba73a30e0f681ee196360",
          measurementId: "G-BWML378TW4" 
        };

        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const firebaseAuth = getAuth(app);
        setAuthInstance(firebaseAuth); // Armazena a instância de autenticação

        setDb(firestore);

        unsubscribeAuthListener = onAuthStateChanged(firebaseAuth, (user) => {
          if (user) {
            setUserId(user.uid);
            // Melhoria: Mostrar email do utilizador se disponível
            showSmartFix(`Bem-vindo, utilizador ${user.email || user.uid.substring(0, 8)}...`, 'info');
            setLoading(false); 
          } else {
            // Quando o utilizador não está logado (após logout ou primeira visita)
            // Não faz login anónimo automático aqui.
            setUserId(null); // Garante que userId é null
            setLoading(false); 
            showSmartFix("Por favor, faça login ou registe-se para aceder aos seus dados.", 'info');
          }
        });
      } catch (err) {
        console.error("Erro ao inicializar Firebase:", err);
        showSmartFix("Erro ao carregar a aplicação. Verifique a sua configuração do Firebase.", 'error');
        setLoading(false); 
      }
    };

    initializeFirebase();

    return () => {
      unsubscribeAuthListener();
    };
  }, []); 

  // Fetch sales data when userId and db are available
  useEffect(() => {
    let unsubscribeSalesListener; // Declare local variable for this useEffect

    if (db && userId) { // Apenas tenta buscar dados se db e userId estiverem prontos
      setSmartFixMessage(''); 
      try {
        const appIdForCollection = 'app-id-vendas'; 

        const salesCollectionRef = collection(db, `artifacts/${appIdForCollection}/users/${userId}/dailySales`);
        const q = query(salesCollectionRef, orderBy('timestamp', 'asc')); 

        unsubscribeSalesListener = onSnapshot(q, (snapshot) => { 
          const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setSales(salesData);
        }, (err) => {
          console.error("Erro ao carregar vendas:", err);
          showSmartFix("Não foi possível carregar as vendas. Tente recarregar a página.", 'error');
        });

        return () => {
          if (unsubscribeSalesListener) {
            unsubscribeSalesListener();
          }
        };
      } catch (err) {
        console.error("Erro ao configurar listener de vendas:", err);
        showSmartFix("Erro ao aceder dados de vendas.", 'error');
      }
    } else {
        // Se userId ou db não estiverem prontos, limpa as vendas para evitar mostrar dados antigos
        setSales([]); 
    }
    return () => {
      if (unsubscribeSalesListener) {
        unsubscribeSalesListener();
      }
    };
  }, [db, userId]); 

  // PWA: Listen for beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault(); 
      setDeferredPrompt(e);
      setShowInstallMessage(true);
      console.log('beforeinstallprompt event fired');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // PWA: Handle install click
  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      showSmartFix("Para instalar a aplicação, use o menu 'Partilhar' do seu navegador e selecione 'Adicionar ao Ecrã Principal'.", 'info');
      return;
    }

    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    console.log(`Resposta do utilizador ao prompt de instalação: ${outcome}`);

    setDeferredPrompt(null);
    setShowInstallMessage(false);

    if (outcome === 'accepted') {
      showSmartFix('Aplicação instalada com sucesso!', 'success');
    } else {
      showSmartFix('Instalação cancelada.', 'info');
    }
  };


  // Funções de Autenticação por Email/Password
  const handleEmailSignUp = async () => {
    if (!email || !password) {
      showSmartFix('Por favor, preencha o email e a palavra-passe.', 'warning');
      return;
    }
    // Validação de palavra-passe no lado do cliente
    if (password.length < 6) {
      showSmartFix('A palavra-passe deve ter pelo menos 6 caracteres.', 'warning');
      return;
    }
    if (!authInstance) {
      showSmartFix('Serviço de autenticação não disponível.', 'error');
      return;
    }
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(authInstance, email, password);
      showSmartFix('Registo bem-sucedido! Pode agora iniciar sessão.', 'success');
      setEmail('');
      setPassword('');
      setIsRegistering(false); // Volta para o formulário de login
    } catch (error) {
      console.error("Erro no registo:", error);
      // Mensagem de erro mais amigável para palavras-passe fracas
      if (error.code === 'auth/weak-password') {
        showSmartFix('A palavra-passe é muito fraca. Por favor, use uma palavra-passe mais forte (pelo menos 6 caracteres).', 'error');
      } else if (error.code === 'auth/email-already-in-use') {
        showSmartFix('Este email já está em uso. Tente iniciar sessão ou use outro email.', 'warning');
      } else {
        showSmartFix(`Erro no registo: ${error.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      showSmartFix('Por favor, preencha o email e a palavra-passe.', 'warning');
      return;
    }
    if (!authInstance) {
      showSmartFix('Serviço de autenticação não disponível.', 'error');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(authInstance, email, password);
      showSmartFix('Sessão iniciada com sucesso!', 'success');
      setEmail('');
      setPassword('');
    } catch (error) {
      console.error("Erro no login:", error);
      // Mensagens de erro mais amigáveis para login
      if (error.code === 'auth/invalid-email' || error.code === 'auth/user-not-found') {
        showSmartFix('Email inválido ou utilizador não encontrado.', 'error');
      } else if (error.code === 'auth/wrong-password') {
        showSmartFix('Palavra-passe incorreta.', 'error');
      } else {
        showSmartFix(`Erro no login: ${error.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!authInstance) return;
    setLoading(true);
    try {
      await signOut(authInstance);
      setUserId(null); // Limpa o userId ao fazer logout
      setSales([]); // Limpa os dados de vendas
      showSmartFix('Sessão terminada com sucesso.', 'info');
    } catch (error) {
      console.error("Erro ao terminar sessão:", error);
      showSmartFix(`Erro ao terminar sessão: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Function to add a new sale (from main form)
  const handleAddSale = async () => {
    if (!userId) { // Verifica se há um usuário autenticado antes de adicionar venda
      showSmartFix('Por favor, inicie sessão para adicionar vendas.', 'warning');
      return;
    }
    if (newSaleAmount === '' || isNaN(parseFloat(newSaleAmount))) {
      showSmartFix('Por favor, insira um valor de venda válido.', 'warning');
      return;
    }

    if (!db) { 
      showSmartFix('Aplicação não pronta. Tente novamente.', 'error');
      return;
    }

    setLoading(true);
    setSmartFixMessage(''); 
    try {
      const amount = parseFloat(newSaleAmount);
      const saleDateTime = new Date(selectedSaleDate + 'T12:00:00'); 
      
      const appIdForCollection = 'app-id-vendas'; 

      const salesCollectionRef = collection(db, `artifacts/${appIdForCollection}/users/${userId}/dailySales`);

      await addDoc(salesCollectionRef, {
        amount: amount,
        timestamp: Timestamp.fromDate(saleDateTime), 
        date: selectedSaleDate 
      });
      setNewSaleAmount('');
      setDisplayDate(new Date(selectedSaleDate)); 
      setDisplayMonth(new Date(selectedSaleDate).getMonth()); 
      setDisplayYear(new Date(selectedSaleDate).getFullYear()); 
      setViewMode('daily'); 

      setSelectedSaleDate(new Date().toISOString().split('T')[0]); 
      showSmartFix('Venda adicionada com sucesso!', 'success');
      if (saleInputRef.current) {
        saleInputRef.current.focus();
      }
    } catch (e) {
      console.error("Erro ao adicionar documento: ", e);
      showSmartFix("Erro ao adicionar venda. Por favor, tente novamente.", 'error');
    } finally {
      setLoading(false);
    }
  };

  // Nova função para adicionar venda rápida (do modal)
  const handleQuickAddSale = async (amount) => {
    if (!userId) {
      showSmartFix('Por favor, inicie sessão para adicionar vendas.', 'warning');
      return;
    }
    if (!db) {
      showSmartFix('Aplicação não pronta. Tente novamente.', 'error');
      return;
    }

    setLoading(true);
    setSmartFixMessage('');
    try {
      const saleDateTime = new Date(); // Data de hoje
      const todayDateString = saleDateTime.toISOString().split('T')[0];
      
      const appIdForCollection = 'app-id-vendas'; 

      const salesCollectionRef = collection(db, `artifacts/${appIdForCollection}/users/${userId}/dailySales`);

      await addDoc(salesCollectionRef, {
        amount: amount,
        timestamp: Timestamp.fromDate(saleDateTime), 
        date: todayDateString 
      });
      showSmartFix('Venda rápida adicionada com sucesso!', 'success');
      // Atualiza a visualização para o dia de hoje se a venda foi para hoje
      setDisplayDate(new Date()); 
      setDisplayMonth(new Date().getMonth()); 
      setDisplayYear(new Date().getFullYear()); 
      setViewMode('daily'); 

    } catch (e) {
      console.error("Erro ao adicionar documento rápido: ", e);
      showSmartFix("Erro ao adicionar venda rápida. Por favor, tente novamente.", 'error');
    } finally {
      setLoading(false);
    }
  };


  // Função para apagar uma venda
  const handleDeleteSale = async (saleId) => {
    if (!db || !userId) {
      showSmartFix('Aplicação não pronta ou utilizador não autenticado.', 'error');
      return;
    }
    if (!window.confirm('Tem certeza que deseja apagar esta venda?')) { // Confirmação antes de apagar
        return;
    }

    setLoading(true);
    setSmartFixMessage('');
    try {
        const appIdForCollection = 'app-id-vendas';
        const saleDocRef = doc(db, `artifacts/${appIdForCollection}/users/${userId}/dailySales`, saleId);
        await deleteDoc(saleDocRef);
        showSmartFix('Venda apagada com sucesso!', 'success');
    } catch (e) {
        console.error("Erro ao apagar documento: ", e);
        showSmartFix("Erro ao apagar venda. Por favor, tente novamente.", 'error');
    } finally {
        setLoading(false);
    }
  };


  // Helper function to format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  };

  // Filter sales based on view mode and navigation
  const getFilteredSales = () => {
    return sales.filter(sale => {
      const saleDate = sale.timestamp ? new Date(sale.timestamp.toDate()) : new Date(sale.date);
      saleDate.setHours(0, 0, 0, 0); 

      switch (viewMode) {
        case 'daily':
          const currentDayString = new Date(displayDate).toISOString().split('T')[0];
          return sale.date === currentDayString; 
        case 'weekly':
          const startOfWeek = getStartOfWeek(displayDate);
          const endOfWeek = getEndOfWeek(displayDate);
          return saleDate >= startOfWeek && saleDate <= endOfWeek;
        case 'monthly':
          return saleDate.getMonth() === displayMonth && saleDate.getFullYear() === displayYear;
        case 'yearly':
          return saleDate.getFullYear() === displayYear;
        default:
          return true;
      }
    });
  };

  const filteredSales = getFilteredSales();
  const currentPeriodTotal = filteredSales.reduce((sum, sale) => sum + sale.amount, 0);

  // Prepare data for the chart based on viewMode
  const getChartData = () => {
    const aggregatedData = {};

    filteredSales.forEach(sale => {
      const saleDate = sale.timestamp ? new Date(sale.timestamp.toDate()) : new Date(sale.date);
      let key; 
      let label; 

      switch (viewMode) {
        case 'daily':
          key = sale.date; 
          label = new Date(sale.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
          break;
        case 'weekly':
          const weekNumber = getWeekNumber(saleDate);
          key = `${saleDate.getFullYear()}-W${weekNumber}`;
          label = `Semana ${weekNumber}`;
          break;
        case 'monthly':
          const monthWeekNumber = getWeekNumber(saleDate);
          const startOfPeriodWeek = getStartOfWeek(saleDate);
          const endOfPeriodWeek = getEndOfWeek(saleDate);

          const monthStart = new Date(displayYear, displayMonth, 1);
          const monthEnd = new Date(displayYear, displayMonth + 1, 0, 23, 59, 59, 999);

          let displayStart = startOfPeriodWeek;
          let displayEnd = endOfPeriodWeek;

          if (startOfPeriodWeek < monthStart) {
              displayStart = monthStart;
          }
          if (endOfPeriodWeek > monthEnd) {
              displayEnd = monthEnd;
          }

          key = `${saleDate.getFullYear()}-${saleDate.getMonth() + 1}-W${monthWeekNumber}`;
          label = `${displayStart.toLocaleDateString('pt-BR', { day: '2-digit' })} - ${displayEnd.toLocaleDateString('pt-BR', { day: '2-digit' })}`;
          break;
        case 'yearly':
          const month = saleDate.getMonth();
          const year = saleDate.getFullYear();
          key = `${year}-${month}`; 
          label = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long' });
          break;
        default:
          key = sale.date;
          label = sale.date;
      }

      if (aggregatedData[key]) {
        aggregatedData[key].total += sale.amount;
      } else {
        aggregatedData[key] = {
          key: key, 
          label: label,
          total: sale.amount,
          date: saleDate 
        };
      }
    });

    const data = Object.values(aggregatedData).sort((a, b) => {
      if (a.date && b.date) {
        return a.date - b.date;
      }
      return a.key.localeCompare(b.key);
    });

    return data;
  };

  const chartData = getChartData();

  // Custom Label component for the AreaChart peaks
  const CustomLabel = (props) => {
    const { x, y, value } = props;
    if (value > 0) {
      return (
        <text x={x} y={y} dy={-8} fill="#20B2AA" fontSize={12} textAnchor="middle" fontWeight="bold">
          {formatCurrency(value)}
        </text>
      );
    }
    return null;
  };


  // Handle navigation for different periods
  const handleNavigate = (direction) => {
    let newDate = new Date(displayDate);
    let newMonth = displayMonth;
    let newYear = displayYear;

    switch (viewMode) {
      case 'daily':
        newDate.setDate(displayDate.getDate() + direction);
        setDisplayDate(newDate);
        break;
      case 'weekly':
        newDate.setDate(displayDate.getDate() + (direction * 7)); 
        setDisplayDate(newDate);
        break;
      case 'monthly':
        newMonth += direction;
        if (newMonth > 11) {
          newMonth = 0;
          newYear++;
        } else if (newMonth < 0) {
          newMonth = 11;
          newYear--;
        }
        setDisplayMonth(newMonth);
        setDisplayYear(newYear);
        setDisplayDate(new Date(newYear, newMonth, 1));
        break;
      case 'yearly':
        newYear += direction;
        setDisplayYear(newYear);
        setDisplayDate(new Date(newYear, 0, 1));
        break;
      default:
        break;
    }
  };

  // Format the period string for display
  const formatDisplayPeriod = () => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const date = new Date(displayDate); 
    date.setFullYear(displayYear, displayMonth, 1); 

    switch (viewMode) {
      case 'daily':
        return `Dia: ${new Date(displayDate).toLocaleDateString('pt-BR', options)}`;
      case 'weekly':
        const startOfWeek = getStartOfWeek(displayDate).toLocaleDateString('pt-BR');
        const endOfWeek = getEndOfWeek(displayDate).toLocaleDateString('pt-BR');
        return `Semana: ${startOfWeek} - ${endOfWeek} (Semana ${getWeekNumber(displayDate)})`;
      case 'monthly':
        return `Mês: ${new Date(displayYear, displayMonth, 1).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' })}`;
      case 'yearly':
        return `Ano: ${displayYear}`;
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4 font-sans text-gray-800">
      <SmartFix message={smartFixMessage} type={smartFixType} onClose={() => setSmartFixMessage('')} />

      {/* Janela Flutuante para Adicionar Venda Rápida */}
      <FloatingSaleModal 
        isOpen={showFloatingSaleModal}
        onClose={() => setShowFloatingSaleModal(false)}
        onQuickAddSale={handleQuickAddSale}
        loading={loading}
        showSmartFix={showSmartFix}
      />

      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-4xl backdrop-filter backdrop-blur-sm bg-opacity-90 border border-purple-300">
        <h1 className="text-4xl font-extrabold text-center text-purple-800 mb-8 tracking-tight">
          💸 Minhas Vendas 💸
        </h1>

        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-500"></div>
            <p className="ml-4 text-purple-700 text-lg">A carregar dados...</p>
          </div>
        ) : (
          <>
            {/* Formulário de Login/Registo */}
            {!userId ? (
              <div className="mb-8 p-6 bg-purple-50 rounded-lg shadow-inner border border-purple-200">
                <h2 className="text-2xl font-bold text-purple-700 mb-4 text-center">
                  {isRegistering ? 'Registar' : 'Iniciar Sessão'}
                </h2>
                <div className="flex flex-col gap-4 mb-4">
                  <input
                    type="email"
                    className="p-3 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg shadow-sm"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <input
                    type="password"
                    className="p-3 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg shadow-sm"
                    placeholder="Palavra-passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <button
                  onClick={isRegistering ? handleEmailSignUp : handleEmailSignIn}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 active:scale-95 flex items-center justify-center text-lg mb-4"
                >
                  {isRegistering ? 'Registar' : 'Iniciar Sessão'}
                </button>
                <button
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="w-full text-purple-600 hover:text-purple-800 font-semibold py-2 px-4 rounded-lg transition duration-200"
                >
                  {isRegistering ? 'Já tem conta? Inicie sessão' : 'Não tem conta? Registe-se'}
                </button>
                <p className="text-center text-sm text-gray-500 mt-4">
                  O seu ID de Utilizador atual (anónimo): {userId || 'A carregar...'}
                </p>
              </div>
            ) : (
              <>
                {showInstallMessage && (
                  <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded relative mb-4 flex items-center justify-between" role="alert">
                    <span>Quer instalar esta aplicação para acesso rápido?</span>
                    <button
                      onClick={handleInstallClick}
                      className="ml-4 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 active:scale-95"
                    >
                      Instalar Aplicação
                    </button>
                  </div>
                )}

                <div className="mb-8 p-6 bg-purple-50 rounded-lg shadow-inner border border-purple-200">
                  <h2 className="text-2xl font-bold text-purple-700 mb-4 flex items-center">
                    <svg className="w-6 h-6 mr-2 text-purple-600" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.592 1M12 8V7m0 1v8m0 4v1m-6-10H4m4-2H6m7 0h4m-4 2h2M6 20H4m2-2h2m0-6h2m-2 4h2m-2-6h-2m2 0H8m6 0h2m-2 2h2m-2 0H8"></path></svg>
                    Registar Nova Venda
                  </h2>
                  <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <input
                      ref={saleInputRef}
                      type="number"
                      step="0.01"
                      className="flex-grow p-3 border border-purple-300 rounded-lg focus:ring-2 focus:ring-500 focus:border-transparent text-lg shadow-sm"
                      placeholder="Ex: 50.75"
                      value={newSaleAmount}
                      onChange={(e) => setNewSaleAmount(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddSale();
                        }
                      }}
                    />
                    <input
                        type="date"
                        className="p-3 border border-purple-300 rounded-lg focus:ring-2 focus:ring-500 focus:border-transparent text-lg shadow-sm"
                        value={selectedSaleDate}
                        onChange={(e) => setSelectedSaleDate(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={handleAddSale}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 active:scale-95 flex items-center justify-center text-lg"
                  >
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Adicionar Venda
                  </button>
                </div>

                {/* Botão para abrir a janela flutuante */}
                {userId && ( // Só mostra o botão se o utilizador estiver logado
                  <div className="mb-8 text-center">
                    <button
                      onClick={() => setShowFloatingSaleModal(true)}
                      className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 active:scale-95 flex items-center justify-center text-lg mx-auto"
                    >
                      <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd"></path></svg>
                      Adicionar Venda Rápida
                    </button>
                  </div>
                )}

                {/* Seletor de Modo de Visualização */}
                <div className="mb-6 flex justify-center space-x-4">
                  <button
                    onClick={() => {
                      setViewMode('daily');
                      setDisplayDate(new Date()); // Redefine para hoje
                    }}
                    className={`py-2 px-5 rounded-lg font-semibold transition duration-200 ${viewMode === 'daily' ? 'bg-purple-700 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    Dia
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('weekly');
                      setDisplayDate(new Date()); // Redefine para a semana atual
                    }}
                    className={`py-2 px-5 rounded-lg font-semibold transition duration-200 ${viewMode === 'weekly' ? 'bg-purple-700 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    Semana
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('monthly');
                      setDisplayMonth(new Date().getMonth()); // Redefine para o mês atual
                      setDisplayYear(new Date().getFullYear()); // Redefine para o ano atual
                    }}
                    className={`py-2 px-5 rounded-lg font-semibold transition duration-200 ${viewMode === 'monthly' ? 'bg-purple-700 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    Mês
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('yearly');
                      setDisplayYear(new Date().getFullYear()); // Redefine para o ano atual
                    }}
                    className={`py-2 px-5 rounded-lg font-semibold transition duration-200 ${viewMode === 'yearly' ? 'bg-purple-700 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    Ano
                  </button>
                </div>

                {/* Navegação por períodos */}
                <div className="mb-8 flex items-center justify-between p-4 bg-purple-100 rounded-lg shadow-inner border border-purple-200">
                  <button
                    onClick={() => handleNavigate(-1)}
                    className="p-2 rounded-full bg-purple-300 text-purple-800 hover:bg-purple-400 transition duration-200"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                  </button>
                  <h2 className="text-xl font-bold text-purple-800 text-center flex-grow">
                    Vendas de: {formatDisplayPeriod()}
                  </h2>
                  <button
                    onClick={() => handleNavigate(1)}
                    className="p-2 rounded-full bg-purple-300 text-purple-800 hover:bg-purple-400 transition duration-200"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                  </button>
                </div>

                <div className="bg-purple-100 p-6 rounded-xl shadow-lg border border-purple-300 mb-8">
                  <h2 className="text-xl font-semibold text-purple-700 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-purple-600" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v12a4 4 0 11-8 0V4a2 2 0 114 0v12a4 4 0 11-8 0"></path></svg>
                    Total do Período
                  </h2>
                  <p className="text-4xl font-bold text-purple-900">
                    {formatCurrency(currentPeriodTotal)}
                  </p>
                </div>

                {/* Gráfico de Vendas (Gráfico de Área) */}
                <div className="bg-white p-6 rounded-xl shadow-lg border border-purple-300 mb-8">
                    <h2 className="text-2xl font-bold text-purple-700 mb-4 flex items-center">
                        <svg className="w-6 h-6 mr-2 text-purple-600" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M18 14H5a2 2 0 00-2 2v2a2 2 0 002 2h14a2 2 0 002-2v-2a2 2 0 00-2-2z"></path></svg>
                        Análise Visual de Vendas
                    </h2>
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={chartData} margin={{ top: 30, right: 30, left: 20, bottom: 5 }}> {/* Margem superior aumentada */}
                                <defs>
                                    {/* Gradiente para vendas reais */}
                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#20B2AA" stopOpacity={0.8}/> {/* Azul-petróleo claro */}
                                        <stop offset="95%" stopColor="#20B2AA" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0"/>
                                <XAxis
                                    dataKey="label" // Usa 'label' para exibição do eixo X
                                    style={{ fontSize: '0.75rem' }} // Fonte menor para rótulos
                                />
                                <YAxis tickFormatter={(tick) => formatCurrency(tick)} style={{ fontSize: '0.75rem' }}/>
                                <Tooltip
                                    formatter={(value, name) => `${name}: ${formatCurrency(value)}`} // Formata o valor e mostra o nome da série
                                    labelFormatter={(label, payload) => {
                                      // Encontra o ponto de dados correspondente para obter a data/período real
                                      const dataPoint = payload[0]?.payload;
                                      if (!dataPoint) return label;

                                      switch (viewMode) {
                                        case 'daily':
                                          return `Vendas em ${new Date(dataPoint.key).toLocaleDateString('pt-BR', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}`;
                                        case 'weekly':
                                          return `Vendas da ${dataPoint.label} de ${new Date(dataPoint.date).getFullYear()}`;
                                        case 'monthly':
                                          // Rótulo da dica de ferramenta ajustado para a visualização mensal para mostrar informações da semana
                                          const weekStartDate = getStartOfWeek(new Date(dataPoint.date)); // Usa dataPoint.date
                                          const weekEndDate = getEndOfWeek(new Date(dataPoint.date)); // Usa dataPoint.date
                                          return `Vendas da ${dataPoint.label} (${weekStartDate.toLocaleDateString('pt-BR')} - ${weekEndDate.toLocaleDateString('pt-BR')}) de ${new Date(displayYear, displayMonth, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
                                        case 'yearly':
                                          return `Vendas de ${dataPoint.label} de ${dataPoint.key.split('-')[0]}`;
                                        default:
                                          return label;
                                      }
                                    }}
                                />
                                <Legend />
                                <Area
                                  type="monotone"
                                  dataKey="total" // Vendas reais
                                  stroke="#20B2AA" // Traço mais claro para vendas reais
                                  fillOpacity={1}
                                  fill="url(#colorTotal)"
                                  activeDot={{ r: 8 }}
                                  name={
                                    viewMode === 'monthly' ? 'Vendas Semanais no Mês' : 'Vendas Mensais no Ano' // Nome dinâmico com base no viewMode
                                  }
                                >
                                    <LabelList dataKey="total" content={<CustomLabel />} /> {/* Adiciona o componente LabelList */}
                                </Area>
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-purple-600 italic text-center">Adicione vendas para visualizar o gráfico.</p>
                    )}
                </div>

                <div className="bg-white p-6 rounded-xl shadow-lg border border-purple-300">
                  <h2 className="text-2xl font-bold text-purple-700 mb-4 flex items-center">
                    <svg className="w-6 h-6 mr-2 text-purple-600" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                    Vendas Detalhadas
                  </h2>
                  {filteredSales.length > 0 ? (
                    <ul className="divide-y divide-purple-200">
                      {filteredSales.map(sale => (
                        <li key={sale.id} className="py-3 flex justify-between items-center text-purple-800">
                          <span className="text-lg">
                            {sale.timestamp ? new Date(sale.timestamp.toDate()).toLocaleString('pt-BR') : 'Data Indisponível'}
                          </span>
                          <span className="font-semibold text-xl">{formatCurrency(sale.amount)}</span>
                          <button
                            onClick={() => handleDeleteSale(sale.id)}
                            className="ml-4 p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition duration-200"
                            title="Apagar Venda"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 000-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd"></path></svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-purple-600 italic">Nenhuma venda registada para este período.</p>
                  )}
                </div>
                {userId && (
                  <p className="text-xs text-center text-gray-500 mt-6">
                    ID do Utilizador: {userId}
                  </p>
                )}
                {userId && ( // Botão de Logout visível apenas se o utilizador estiver autenticado
                  <div className="mt-6 text-center">
                    <button
                      onClick={handleSignOut}
                      className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 active:scale-95"
                    >
                      Terminar Sessão
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
