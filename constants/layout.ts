import { Platform } from 'react-native';

/**
 * Espaço no topo dos cabeçalhos das abas. No navegador (web) não há barra de
 * status para desviar; no app nativo sim.
 */
export const HEADER_TOP_PADDING = Platform.OS === 'web' ? 10 : 44;
