import { Routes } from "@angular/router";
import { authGuard } from "./guards/auth.guard";
import { roleGuard } from "./guards/role.guard";

export const routes: Routes = [
  {
    path: "login",
    title: "Iniciar sesión",
    loadComponent: () => import("./pages/login/login.component").then(m => m.LoginComponent),
  },
  {
    path: "",
    canActivate: [authGuard],
    loadComponent: () => import("./layout/layout.component").then(m => m.LayoutComponent),
    children: [
      { path: "", redirectTo: "dashboard", pathMatch: "full" },
      { path: "dashboard", title: "Dashboard", runGuardsAndResolvers: "always", loadComponent: () => import("./pages/dashboard/dashboard.component").then(m => m.DashboardComponent) },
      { path: "deudores", title: "Deudores", runGuardsAndResolvers: "always", loadComponent: () => import("./pages/deudores/deudores.component").then(m => m.DeudoresComponent) },
      { path: "deudores/:id", title: "Detalle deudor", runGuardsAndResolvers: "always", loadComponent: () => import("./pages/deudor-detail/deudor-detail.component").then(m => m.DeudorDetailComponent) },
      { path: "pagos", title: "Pagos", runGuardsAndResolvers: "always", loadComponent: () => import("./pages/pagos/pagos.component").then(m => m.PagosComponent) },
      { path: "prestamos", title: "Préstamos", runGuardsAndResolvers: "always", loadComponent: () => import("./pages/prestamos/prestamos.component").then(m => m.PrestamosComponent) },
      { path: "alertas", title: "Alertas", runGuardsAndResolvers: "always", loadComponent: () => import("./pages/alertas/alertas.component").then(m => m.AlertasComponent) },
      { path: "reparto", title: "Reparto", runGuardsAndResolvers: "always", loadComponent: () => import("./pages/reparto/reparto.component").then(m => m.RepartoComponent) },
      { path: "usuarios", title: "Usuarios", canActivate: [roleGuard(['admin'])], runGuardsAndResolvers: "always", loadComponent: () => import("./pages/usuarios/usuarios.component").then(m => m.UsuariosComponent) },
    ],
  },
  { path: "**", redirectTo: "" },
];
