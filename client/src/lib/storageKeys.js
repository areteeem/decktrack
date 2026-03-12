/**
 * Centralized localStorage key constants for Flashy.
 *
 * Every localStorage key the app uses should be defined here so they
 * are easy to find, rename, or namespace in one place.
 */

export const STORAGE_KEYS = {
  /** Supabase auth persistence key */
  auth: 'flashy_auth_v1',

  /** UI theme preference (light / dark) */
  theme: 'flashy.theme',

  /** Study session state per deck. Append deckId: `${prefix}<deckId>` */
  sessionPrefix: 'flashy.session.',

  /** Cumulative study timer */
  studyTime: 'flashy.studyTime',

  /** Student-app launch bridge data */
  studentAppBridge: 'flashy.studentAppBridge.v1',
};
