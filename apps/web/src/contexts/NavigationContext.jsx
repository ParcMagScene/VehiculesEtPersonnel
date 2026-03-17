import { createContext, useContext } from 'react';

const NavigationContext = createContext(null);

export const NavigationProvider = NavigationContext.Provider;

export const useNavigation = () => useContext(NavigationContext);

export default NavigationContext;
