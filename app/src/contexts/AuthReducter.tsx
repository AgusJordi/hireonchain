// src/contexts/authReducer.ts

export interface AuthState {
  isAuthenticated: boolean;
  publicKey: string | null;
  isAuthenticating: boolean;
  error: string | null;
  user: {
    publicKey: string;
    // Add other user fields as needed
  } | null;
}

export type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { publicKey: string } }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'CLEAR_ERROR' };

const token = localStorage.getItem('sol_token') ? true : false;

export const initialAuthState: AuthState = {
  isAuthenticated: token,
  publicKey: null,
  isAuthenticating: false,
  error: null,
  user: null,
};

export const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isAuthenticating: true,
        error: null,
      };

    case 'AUTH_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        publicKey: action.payload.publicKey,
        isAuthenticating: false,
        error: null,
        user: {
          publicKey: action.payload.publicKey,
        },
      };

    case 'AUTH_FAILURE':
      return {
        ...state,
        isAuthenticated: false,
        publicKey: null,
        isAuthenticating: false,
        error: action.payload,
        user: null,
      };

    case 'AUTH_LOGOUT':
      return {
        ...initialAuthState,
        isAuthenticated: false,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    default:
      return state;
  }
};
