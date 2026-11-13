export function actionFailure(error) {
  return { success: false, error };
}

// Expected failures are returned as data so production React does not redact
// their messages. Unexpected details stay in server logs, never in form UI.
export async function runAction(operation, fallback) {
  try {
    return await operation();
  } catch (error) {
    console.error(fallback, error);
    return actionFailure(fallback);
  }
}

export const UNEXPECTED_ACTION_ERROR =
  "Something went wrong. Please try again. If it keeps happening, refresh the page.";
