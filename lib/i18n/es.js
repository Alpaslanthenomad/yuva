// lib/i18n/es.js — Diccionario en español (variante chilena). La estructura de claves debe
// coincidir exactamente con tr.js (lo verifica tests/i18n.test.js).
const es = {
  app: { name: 'YUVA', tagline: 'Sistema de gestión familiar' },

  nav: { today: 'Hoy', calendar: 'Calendario', money: 'Dinero', plans: 'Planes', family: 'Familia', settings: 'Ajustes' },

  common: {
    add: 'Agregar', save: 'Guardar', cancel: 'Cancelar', delete: 'Eliminar', edit: 'Editar', close: 'Cerrar',
    all: 'Todos', me: 'Yo', shared: 'Común', none: 'Ninguno', more: 'Ver más',
    seeAll: 'Ver todo', empty: 'Todavía no hay nada', loading: 'Cargando…', note: 'Nota',
    copy: 'Copiar', copied: 'Copiado', total: 'Total', notifications: 'Notificaciones',
    confirmDelete: (x) => `¿Eliminar ${x}?`,
    pct: (n) => `${n}%`,
    demoBanner: 'Modo demo — los datos se guardan en este dispositivo. Al conectar Supabase se comparten con la familia.',
    welcome: 'Te damos la bienvenida',
  },

  today: {
    greeting: (name) => `Hola ${name}`,
    agenda: 'Agenda de hoy', week: 'Esta semana', moneyPulse: 'Pulso del dinero', spentThisMonth: 'Gastado este mes',
    budgetLeft: 'Presupuesto restante', perDay: 'por día', upcoming: 'Próximamente', tasksDue: 'Tareas de hoy',
    shopping: 'Lista de compras', itemsLeft: (n) => `${n} pendientes`, noEvents: 'Hoy no hay nada agendado — qué bueno.',
    bills: 'Cuentas por vencer', docs: 'Documentos por vencer', occasions: 'Fechas importantes', top3: 'Las 3 categorías mayores',
  },

  calendar: {
    title: 'Calendario', day: 'Día', week: 'Semana', month: 'Mes', agenda: 'Agenda', holiday: 'Feriado',
    newEvent: 'Nuevo evento', titleField: 'Título', start: 'Inicio', end: 'Término', allDay: 'Todo el día',
    category: 'Categoría', attendees: 'Participantes', location: 'Lugar', repeat: 'Repetir',
    conflict: 'Conflicto: la misma persona tiene otro evento a esa hora',
    categories: { work: 'Trabajo', school: 'Colegio', health: 'Salud', social: 'Social', sport: 'Deporte', travel: 'Viaje', home: 'Casa', other: 'Otro' },
    repeats: { none: 'No se repite', daily: 'Cada día', weekly: 'Cada semana', monthly: 'Cada mes', yearly: 'Cada año' },
  },

  money: {
    title: 'Dinero', overview: 'Resumen', transactions: 'Movimientos', budgets: 'Presupuesto', bills: 'Recurrentes', accounts: 'Cuentas',
    expense: 'Gasto', income: 'Ingreso', transfer: 'Transferencia', amount: 'Monto', currency: 'Moneda', account: 'Cuenta',
    fromAccount: 'Cuenta de origen', toAccount: 'Cuenta de destino', category: 'Categoría', merchant: 'Dónde / a quién',
    merchantHint: 'Jumbo, Copec, arriendo…', date: 'Fecha', paidBy: 'Quién pagó', forWhom: 'Para quién',
    balance: 'Saldo', net: 'Neto', savingsRate: 'Tasa de ahorro', monthBudget: 'Presupuesto del mes',
    byCategory: 'Por categoría', byMember: 'Por persona', fixed: 'Fijo', variable: 'Variable',
    over: 'excedido', left: 'disponible', nextDue: 'Próximo vencimiento', autoPost: 'Registrar automáticamente', monthlyFixed: 'Gasto fijo mensual',
    noBudget: 'No hay presupuesto definido. Puedes agregarlo abajo.', addTxn: 'Agregar gasto', addBudget: 'Agregar presupuesto',
    vsLastMonth: 'vs. mes anterior', totalBudget: 'Total', totalIn: (c) => `Total (${c})`,
    errAmount: 'Monto inválido', errToAccount: 'Elige la cuenta de destino',
  },

  plans: {
    title: 'Planes', trip: 'Viaje', gathering: 'Celebración', project: 'Proyecto', goal: 'Meta',
    budget: 'Presupuesto', actual: 'Gastado', items: 'Elementos',
    checklist: 'Lista de control', itinerary: 'Itinerario', bookings: 'Reservas', guests: 'Invitados',
    statuses: { idea: 'Idea', planned: 'Planificado', active: 'En curso', done: 'Terminado', cancelled: 'Cancelado' },
    progress: 'Avance', daysLeft: (n) => `faltan ${n} días`, target: 'Meta',
    guestSummary: (yes, total) => `${yes} confirmados · ${total} invitados`,
    people: (n) => `${n} personas`, newPlan: 'Nuevo plan',
  },

  family: {
    title: 'Familia', members: 'Integrantes', occasions: 'Fechas importantes', documents: 'Documentos y vencimientos',
    tasks: 'Tareas', shopping: 'Compras',
    roles: { adult: 'Adulto', child: 'Niño/a', guest: 'Invitado' },
    kinds: { birthday: 'Cumpleaños', anniversary: 'Aniversario', memorial: 'Conmemoración', custom: 'Fecha especial' },
    docKinds: { passport: 'Pasaporte', id: 'Carnet de identidad', license: 'Licencia de conducir', visa: 'Visa', insurance: 'Seguro', contract: 'Contrato', vehicle: 'Vehículo', other: 'Otro' },
    expires: 'Vence el', expired: 'Vencido', expiresIn: (n) => `faltan ${n} días`,
    daysShort: (n) => `${n} días`, turns: (n) => `cumple ${n} años`,
    points: 'puntos', assign: 'Responsable', due: 'Vence', addTask: 'Agregar tarea', weeklyStars: 'estrellas',
    addMember: 'Agregar integrante', addOccasion: 'Agregar fecha', addDocument: 'Agregar documento',
    memberName: 'Nombre', role: 'Rol', emoji: 'Emoji', color: 'Color',
    birthdate: 'Fecha de nacimiento', birthdateHint: 'Si la ingresas, el cumpleaños se crea solo',
    occasionKind: 'Tipo', firstYear: 'Fecha (primer año)', remindDays: 'Avisar con cuántos días',
    giftIdeas: 'Ideas de regalo', member: 'Integrante', numberHint: 'Pista del número (solo los últimos 4 dígitos)',
    childrenNoAccount: 'Los adultos entran con este código; los niños no necesitan cuenta.',
    clearChecked: 'Borrar los marcados',
  },

  settings: {
    title: 'Ajustes', household: 'Hogar', name: 'Nombre del hogar', baseCurrency: 'Moneda principal', timezone: 'Zona horaria',
    holidays: 'Calendarios de feriados', joinCode: 'Código de invitación',
    joinCodeHint: 'Tu pareja entra con este código y se une al hogar. Los niños no necesitan cuenta.',
    accounts: 'Cuentas', categories: 'Categorías', rates: 'Tipos de cambio',
    ratesHint: 'El tipo de cambio se congela en la fecha del movimiento; si cambia después, los registros antiguos no se alteran.',
    data: 'Datos', exportCsv: 'Exportar CSV', resetDemo: 'Reiniciar datos demo', signOut: 'Cerrar sesión',
    connect: 'Conexión con Supabase', connected: 'Conectado', demo: 'Demo (local)',
    connectedHint: 'Este dispositivo está conectado al proyecto de Supabase; los datos se sincronizan con la familia.',
    demoHint: 'Para conectar, escribe NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en el archivo .env y vuelve a compilar. Esquema: supabase/migrations/',
    password: 'Contraseña', newPassword: 'Nueva contraseña', changePassword: 'Cambiar contraseña',
    passwordChanged: 'Tu contraseña fue cambiada.',
    language: 'Idioma de la aplicación',
    languageHint: 'Esta elección afecta solo a tu dispositivo. Cada integrante puede elegir su propio idioma.',
    householdLanguage: 'Idioma predeterminado del hogar',
    householdLanguageHint: 'Quienes se unan después parten con este idioma.',
  },

  quick: {
    title: 'Agregar rápido', expense: 'Gasto', event: 'Evento', task: 'Tarea', shopping: 'Compras', note: 'Nota',
    added: 'Agregado', shoppingItem: '¿Qué hay que comprar?', taskTitle: '¿Qué hay que hacer?',
  },

  auth: {
    title: 'Ingresar', email: 'Correo electrónico', password: 'Contraseña',
    signIn: 'Entrar', signUp: 'Crear cuenta',
    tabSignIn: 'Ya tengo cuenta', tabSignUp: 'Es mi primera vez',
    passwordHint: 'Mínimo 6 caracteres. Puedes guardarla en el navegador.',
    createHousehold: 'Crear un hogar nuevo', joinHousehold: 'Unirme con un código', code: 'Código de invitación',
    demoEnter: 'Continuar en modo demo', yourName: 'Tu nombre',
    errWrong: 'Correo o contraseña incorrectos.',
    errShort: 'La contraseña debe tener al menos 6 caracteres.',
    errExists: 'Ya existe una cuenta con este correo — entra desde la pestaña “Ya tengo cuenta”.',
    errNeedsConfirm: 'En Supabase sigue activa la confirmación por correo. Hay que desactivar “Confirm email” en Authentication › Sign In / Providers › Email.',
    errGeneric: 'No se pudo entrar. Revisa tu conexión e inténtalo de nuevo.',
  },

  holidays: {
    // Chile
    cl_newyear: 'Año Nuevo', cl_goodfriday: 'Viernes Santo', cl_holysaturday: 'Sábado Santo',
    cl_labour: 'Día del Trabajo', cl_navales: 'Glorias Navales',
    cl_indigenous: 'Día de los Pueblos Indígenas', cl_pedropablo: 'San Pedro y San Pablo',
    cl_carmen: 'Virgen del Carmen', cl_asuncion: 'Asunción de la Virgen',
    cl_patrias: 'Fiestas Patrias', cl_ejercito: 'Glorias del Ejército',
    cl_dosmundos: 'Encuentro de Dos Mundos', cl_evangelicas: 'Día de las Iglesias Evangélicas',
    cl_santos: 'Día de Todos los Santos', cl_inmaculada: 'Inmaculada Concepción', cl_navidad: 'Navidad',
    // Turquía
    tr_newyear: 'Año Nuevo', tr_cocuk: 'Día de la Soberanía Nacional y del Niño',
    tr_emek: 'Día del Trabajo y la Solidaridad', tr_genclik: 'Día de la Juventud y el Deporte',
    tr_demokrasi: 'Día de la Democracia y la Unidad Nacional', tr_zafer: 'Día de la Victoria',
    tr_cumhuriyet: 'Día de la República',
    tr_ramazan: (n) => `Fiesta del Ramadán, día ${n}`, tr_kurban: (n) => `Fiesta del Sacrificio, día ${n}`,
  },

  currencies: { CLP: 'Peso chileno', TRY: 'Lira turca', USD: 'Dólar estadounidense', EUR: 'Euro' },

  countries: { CL: 'Chile', TR: 'Turquía' },
};
export default es;
