import { Routes } from "@angular/router";
import { authGuard } from "./guards/auth.guard";

export const routes: Routes = [
  {
    path: "login",
    loadComponent: () => import("./pages/login/login.component").then(m => m.LoginComponent),
  },
  {
    path: "",
    canActivate: [authGuard],
    loadComponent: () => import("./layout/layout.component").then(m => m.LayoutComponent),
    children: [
      { path: "", redirectTo: "dashboard", pathMatch: "full" },
      { path: "dashboard", runGuardsAndResolvers: "always", loadComponent: () => import("./pages/dashboard/dashboard.component").then(m => m.DashboardComponent) },
      { path: "deudores", runGuardsAndResolvers: "always", loadComponent: () => import("./pages/deudores/deudores.component").then(m => m.DeudoresComponent) },
      { path: "deudores/:id", runGuardsAndResolvers: "always", loadComponent: () => import("./pages/deudor-detail/deudor-detail.component").then(m => m.DeudorDetailComponent) },
      { path: "pagos", runGuardsAndResolvers: "always", loadComponent: () => import("./pages/pagos/pagos.component").then(m => m.PagosComponent) },
      { path: "prestamos", runGuardsAndResolvers: "always", loadComponent: () => import("./pages/prestamos/prestamos.component").then(m => m.PrestamosComponent) },
    ],
  },
  { path: "**", redirectTo: "" },
];
