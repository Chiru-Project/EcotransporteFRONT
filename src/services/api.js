// API base url comes from Vite environment variable. In development the .env file
// supplies VITE_API_URL (default http://localhost:3000), but in a deployed build
// this value should be set to the real backend host. Using import.meta.env allows
// the value to be replaced at build time.

const API_URL = import.meta.env.VITE_API_URL || '';
export { API_URL };

// Helper para manejar respuestas
const handleResponse = async (response) => {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error((data && data.message) || 'Error en la petición');
    if (data?.rejected) {
      error.rejected = true;
      error.reason = data.reason;
    }
    throw error;
  }
  return data;
};

// Obtener token del localStorage
const getToken = () => localStorage.getItem('accessToken');

// Headers con autenticación
const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
});

// ==================== AUTENTICACIÓN ====================

export const authService = {
  login: async (email, password) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return handleResponse(response);
  },

  signup: async (email, password, userName) => {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, userName })
    });
    return handleResponse(response);
  },

  logout: async () => {
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  requestResetPassword: async (email) => {
    const response = await fetch(`${API_URL}/auth/requestResetPassword`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return handleResponse(response);
  },

  resetPassword: async (token, password) => {
    const response = await fetch(`${API_URL}/auth/resetPassword`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });
    return handleResponse(response);
  }
};

// ==================== DOCUMENTOS ====================

export const documentService = {
  upload: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/documents/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      },
      body: formData
    });
    return handleResponse(response);
  },

  createManual: async (data) => {
    const response = await fetch(`${API_URL}/documents/create-manual`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  getAll: async () => {
    const response = await fetch(`${API_URL}/documents`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  getById: async (id) => {
    const response = await fetch(`${API_URL}/documents/${id}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  getUserDocuments: async () => {
    const response = await fetch(`${API_URL}/documents/user/documents`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  update: async (id, data) => {
    const response = await fetch(`${API_URL}/documents/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  delete: async (id) => {
    const response = await fetch(`${API_URL}/documents/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  anular: async (id) => {
    const response = await fetch(`${API_URL}/documents/${id}/anular`, {
      method: 'PATCH',
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  reassociate: async () => {
    const response = await fetch(`${API_URL}/documents/reassociate`, {
      method: 'PATCH',
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  recalculate: async (id) => {
    const response = await fetch(`${API_URL}/documents/${id}/recalculate`, {
      method: 'PATCH',
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  uploadFile: async (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_URL}/documents/${id}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      },
      body: formData
    });
    return handleResponse(response);
  },

  deleteFile: async (id, url) => {
    const response = await fetch(`${API_URL}/documents/${id}/files`, {
      method: 'DELETE',
      headers: authHeaders(),
      body: JSON.stringify({ url })
    });
    return handleResponse(response);
  }
};

// ==================== USUARIOS ====================

export const userService = {
  getAll: async () => {
    const response = await fetch(`${API_URL}/users`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  getById: async (id) => {
    const response = await fetch(`${API_URL}/users/${id}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  create: async (data) => {
    const response = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  update: async (id, data) => {
    const response = await fetch(`${API_URL}/users/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  delete: async (id) => {
    const response = await fetch(`${API_URL}/users/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  getByRole: async (role) => {
    const response = await fetch(`${API_URL}/users/list-by-role/${role}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  }
};

// ==================== ROLES ====================

export const roleService = {
  getAll: async () => {
    const response = await fetch(`${API_URL}/roles`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  create: async (name) => {
    const response = await fetch(`${API_URL}/roles`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name })
    });
    return handleResponse(response);
  }
};

// ==================== USER INFORMATION ====================

export const userInformationService = {
  getAll: async () => {
    const response = await fetch(`${API_URL}/user-information`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  getById: async (id) => {
    const response = await fetch(`${API_URL}/user-information/${id}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  create: async (data) => {
    const response = await fetch(`${API_URL}/user-information`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  update: async (id, data) => {
    const response = await fetch(`${API_URL}/user-information/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  }
};

// ==================== USER ADDRESS ====================

export const userAddressService = {
  getAll: async () => {
    const response = await fetch(`${API_URL}/user-address`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  getByUser: async (userId) => {
    const response = await fetch(`${API_URL}/user-address/user/${userId}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  create: async (data) => {
    const response = await fetch(`${API_URL}/user-address`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  }
};

// ==================== DASHBOARD ====================

export const dashboardService = {
  // Obtener valores para los filtros/segmentadores
  getSegmentadores: async () => {
    const response = await fetch(`${API_URL}/dashboard/segmentadores`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Segmentadores filtrados en cascada (opciones válidas dado el estado actual de filtros)
  getSegmentadoresFiltrados: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/segmentadores-filtrados?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Resumen completo del dashboard
  getResumen: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/resumen?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Lista de guías por verificar
  getGuiasPorVerificarList: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/guias-por-verificar-list?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Guías por verificar (tn_recibida_data_cruda NULL o 0)
  getGuiasPorVerificarCount: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/guias-por-verificar-count?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Tickets no recepcionados (guías sin ticket)
  getTicketsNoRecepcionadosCount: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/tickets-no-recepcionados?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Lista de tickets no recepcionados
  getTicketsNoRecepcionadosList: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/tickets-no-recepcionados-list?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Tickets por verificar
  getTicketsPorVerificar: async () => {
    const response = await fetch(`${API_URL}/dashboard/tickets-por-verificar`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Control de peso
  getControlPeso: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/control-peso?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // TN Enviado por semana
  getTnEnviadoPorSemana: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/tn-enviado-semana?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // TN Recibido por semana
  getTnRecibidoPorSemana: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/tn-recibido-semana?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // TN por concentrado (usa TN enviado por tipo)
  getTnPorConcentrado: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/tn-concentrado-enviado?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // TN Recibido por concentrado
  getTnRecibidoPorConcentrado: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/tn-concentrado-recibido?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // TN por unidad
  getTnPorUnidad: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/tn-por-unidad?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // TN por cliente
  getTnPorCliente: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/tn-por-cliente?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Traslados por unidad
  getTrasladosPorUnidad: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/traslados-por-unidad?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Viajes únicos
  getViajesUnicos: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/viajes-unicos?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Detalle transportista
  getDetalleTransportista: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/detalle-transportista?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Detalle de traslados por transportista (para cortina desplegable)
  getDetalleTransportistaViajes: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/detalle-transportista-viajes?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Tonelaje enviado general
  getTonelajeEnviadoGeneral: async () => {
    const response = await fetch(`${API_URL}/dashboard/tonelaje-enviado-general`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Tonelaje enviado filtrado
  getTonelajeEnviadoFiltrado: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/tonelaje-enviado-filtrado?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Tabla pivot TN recibidas
  getTablaPivot: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/tabla-pivot-tn-recibidas?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // TN por unidad por mes
  getTnPorUnidadMes: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/tn-por-unidad-mes?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // =====================================================
  // NUEVOS ENDPOINTS FINANCIEROS Y DE SEGUIMIENTO
  // =====================================================

  // Por Cobrar: Cliente → Empresa → Divisa
  getPorCobrar: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/por-cobrar?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Por Pagar: Cliente → Empresa → Divisa
  getPorPagar: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/por-pagar?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Margen Operativo: Cliente → Empresa → Divisa
  getMargenOperativo: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/margen-operativo?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // TN Enviado por Cliente y Empresa
  getTnClienteEmpresa: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/tn-cliente-empresa?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Seguimiento de Transporte
  getSeguimientoTransporte: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/seguimiento-transporte?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Resumen Financiero por Divisa
  getResumenFinanciero: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/resumen-financiero?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Lista de empresas de transporte
  getEmpresasTransporte: async () => {
    const response = await fetch(`${API_URL}/dashboard/empresas-transporte`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // =====================================================
  // VIAJES POR CLIENTE
  // =====================================================

  // Días con viajes según cliente y/o placa
  getDiasConViajes: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/dias-con-viajes?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Viajes por placa (para gráfico de barras)
  getViajesPorPlaca: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/viajes-por-placa?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Resumen viajes por cliente
  getResumenViajesCliente: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_URL}/dashboard/resumen-viajes-cliente?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Tablas Detalladas (Venta / Costo / Margen)
  getTablasDetalladas: async (mes, semana) => {
    const params = new URLSearchParams({ mes, ...(semana ? { semana } : {}) }).toString();
    const response = await fetch(`${API_URL}/dashboard/tablas-detalladas?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Opciones para reporte de guías (empresas y meses)
  getReporteGuiasOpciones: async () => {
    const response = await fetch(`${API_URL}/dashboard/reporte-guias-opciones`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  // Reporte de guías emitidas por empresa y mes
  getReporteGuias: async ({ empresa, mes, semana }) => {
    const params = new URLSearchParams({ empresa, mes, ...(semana ? { semana } : {}) }).toString();
    const response = await fetch(`${API_URL}/dashboard/reporte-guias?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  }
};

// ==================== EMPRESAS DE TRANSPORTE ====================

export const empresaTransporteService = {
  getAll: async () => {
    const response = await fetch(`${API_URL}/empresa-transporte`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  getActivas: async () => {
    const response = await fetch(`${API_URL}/empresa-transporte/activas`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  getDadasDeBaja: async () => {
    const response = await fetch(`${API_URL}/empresa-transporte/dadas-de-baja`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  getById: async (id) => {
    const response = await fetch(`${API_URL}/empresa-transporte/${id}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  create: async (data) => {
    const response = await fetch(`${API_URL}/empresa-transporte`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  update: async (id, data) => {
    const response = await fetch(`${API_URL}/empresa-transporte/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  delete: async (id) => {
    const response = await fetch(`${API_URL}/empresa-transporte/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    return handleResponse(response);
  }
};

// ==================== UNIDADES (PLACAS) ====================

export const unidadService = {
  getAll: async () => {
    const response = await fetch(`${API_URL}/unidad`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  getActivas: async () => {
    const response = await fetch(`${API_URL}/unidad/activas`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  getByEmpresa: async (empresaId) => {
    const response = await fetch(`${API_URL}/unidad/empresa/${empresaId}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  getByPlaca: async (placa) => {
    const response = await fetch(`${API_URL}/unidad/placa/${placa}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  getById: async (id) => {
    const response = await fetch(`${API_URL}/unidad/${id}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  create: async (data) => {
    const response = await fetch(`${API_URL}/unidad`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  update: async (id, data) => {
    const response = await fetch(`${API_URL}/unidad/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  delete: async (id) => {
    const response = await fetch(`${API_URL}/unidad/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    return handleResponse(response);
  }
};

// ==================== TARIFAS DE CLIENTES ====================

export const clientTariffService = {
  getAll: async () => {
    const response = await fetch(`${API_URL}/client-tariff`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  getById: async (id) => {
    const response = await fetch(`${API_URL}/client-tariff/${id}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  getByCliente: async (cliente) => {
    const response = await fetch(`${API_URL}/client-tariff/cliente/${encodeURIComponent(cliente)}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  search: async (cliente, partida, llegada) => {
    const params = new URLSearchParams({ cliente, partida, llegada }).toString();
    const response = await fetch(`${API_URL}/client-tariff/search?${params}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  searchMatch: async ({ cliente, partida, llegada, material }) => {
    const params = new URLSearchParams();
    if (cliente) params.append('cliente', cliente);
    if (partida) params.append('partida', partida);
    if (llegada) params.append('llegada', llegada);
    if (material) params.append('material', material);
    const response = await fetch(`${API_URL}/client-tariff/search-match?${params.toString()}`, {
      headers: authHeaders()
    });
    return handleResponse(response);
  },

  create: async (data) => {
    const response = await fetch(`${API_URL}/client-tariff`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  update: async (id, data) => {
    const response = await fetch(`${API_URL}/client-tariff/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  delete: async (id) => {
    const response = await fetch(`${API_URL}/client-tariff/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    return handleResponse(response);
  }
};
