import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'diario' },
  { path: 'diario', loadComponent: () => import('./pages/diary').then((m) => m.Diary) },
  { path: 'resumen', loadComponent: () => import('./pages/summary').then((m) => m.Summary) },
  { path: 'perfil', loadComponent: () => import('./pages/profile').then((m) => m.ProfilePage) },
  { path: 'anadir/:date/:meal', loadComponent: () => import('./pages/add').then((m) => m.AddPage) },
  { path: 'habitual/:id', loadComponent: () => import('./pages/meal-editor').then((m) => m.MealEditor) },
  { path: '**', redirectTo: 'diario' },
];
