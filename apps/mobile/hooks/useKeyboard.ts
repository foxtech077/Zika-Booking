import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * React Native hook to track the software keyboard's visibility state.
 * Returns `true` if the keyboard is visible/open, and `false` otherwise.
 */
export function useKeyboard(): boolean {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    // On iOS, 'keyboardWillShow'/'keyboardWillHide' trigger before the animations start
    // On Android, 'keyboardDidShow'/'keyboardDidHide' are safer and widely supported
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, () => {
      setIsKeyboardOpen(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardOpen(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return isKeyboardOpen;
}
