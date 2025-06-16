// src/app/api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface GraphNode {
  id: number;
  label: string;
  group: 'planet' | 'station' | 'enemy';
}
export interface GraphEdge {
  id: number;
  from: number;
  to: number;
  label: string;
}
export interface ShipPlacement {
  shipId: number;
  nodeId: number;
  label: string;
  fuel: number;
}
export interface RouteStep {
  step: number;
  node_id: number;
  distancia_cumul: number;
  fuel_restante: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  // Genera el grafo en la BD
  generateGraph(): Observable<void> {
    return this.http.post<void>(`${this.base}/graph/generate`, {});
  }

  // Trae nodos y aristas
  getGraph(): Observable<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    return this.http.get<{ nodes: GraphNode[]; edges: GraphEdge[] }>(
      `${this.base}/graph`
    );
  }

  // Coloca la nave en un nodo
  autoPlaceShip(): Observable<ShipPlacement> {
    return this.http.post<ShipPlacement>(
      `${this.base}/ship/auto-place`, {}
    );
  }

    /** Nuevo: pide la ruta desde la posición de la nave a destino */
    getRoute(
      shipId: number,
      fromNode: number,
      toNode: number
    ): Observable<RouteStep[]> {
      const params = new HttpParams()
        .set('shipId', shipId.toString())
        .set('from',   fromNode.toString())
        .set('to',     toNode.toString());
      return this.http.get<RouteStep[]>(`${this.base}/route`, { params });
    }

    updateFuel(shipId: number, fuel: number): Observable<void> {
      return this.http.patch<void>(`${this.base}/${shipId}/fuel`, { fuel });
    }

    /** PATCH /api/graph/edge/:id */
  updateEdgeWeight(edgeId: number, weight: number): Observable<void> {
    return this.http.patch<void>(
      `${this.base}/graph/edge/${edgeId}`,
      { weight }
    );
  }
}
