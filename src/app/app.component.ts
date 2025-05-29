// src/app/app.component.ts
import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { Network, DataSet } from 'vis-network/standalone';
import {
  ApiService,
  GraphNode,
  GraphEdge,
  ShipPlacement,
  RouteStep
} from './api.service';

type VisNode = GraphNode & {
  color: { background: string; border: string };
  size?: number;
};

type VisEdge = GraphEdge & {
  arrows?: { to: boolean; from?: boolean };
  color?: { color: string };
};

@Component({
  selector: 'app-root',
  template: `
    <div class="controls">
      <label>
        Nodo destino:
        <select [(ngModel)]="selectedDestination">
          <option *ngFor="let n of graphNodes" [value]="n.id">{{ n.label }}</option>
        </select>
      </label>
      <button (click)="showRoute()">Mostrar ruta</button>
    </div>

    <div #graphContainer id="graph"></div>

    <div *ngIf="placement" class="info">
      🚀 Nave {{ placement.shipId }} en "<strong>{{ placement.label }}</strong>" —
      Combustible restante: {{ currentFuel }}
    </div>
    <div *ngIf="errorMessage" class="error" style="position:absolute; top:60px; left:10px; padding:8px; background:rgba(255,0,0,0.8); color:white; border-radius:4px;">
     {{ errorMessage }}
    </div>
  `,
  styles: [`
    :host {
      display: block;
      position: relative;
      height: 100vh;
      width: 100vw;
      margin: 0;
    }
    .controls {
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 10;
      background: rgba(255,255,255,0.9);
      padding: 8px;
      border-radius: 4px;
    }
    #graph {
      position: absolute;
      top: 0; bottom: 0; left: 0; right: 0;
    }
    .info {
      position: absolute;
      bottom: 10px;
      left: 10px;
      background: rgba(255,255,255,0.8);
      padding: 8px 12px;
      border-radius: 4px;
      font-family: sans-serif;
    }
  `]
})
export class AppComponent implements AfterViewInit {
  @ViewChild('graphContainer', { static: true })
  graphContainer!: ElementRef<HTMLDivElement>;

  graphNodes: GraphNode[] = [];
  private network!: Network;
  private nodesDS!: DataSet<VisNode>;
  private edgesDS!: DataSet<VisEdge>;
  placement?: ShipPlacement;
  selectedDestination?: number;
  errorMessage:string = '';

  private shipPlacement?: ShipPlacement;
  currentFuel?: number;
  private shipNodeId?: number;

  private groupColors = {
    planet:  { background: 'lightblue',  border: 'blue'   },
    station: { background: 'lightgreen', border: 'green'  },
    enemy:   { background: 'lightcoral', border: 'red'    }
  };

  constructor(private api: ApiService) {}

  ngAfterViewInit(): void {
    // 1) Generar y dibujar grafo
    this.api.generateGraph().subscribe(() => {
      this.api.getGraph().subscribe(graph => {
        this.graphNodes = graph.nodes;

        const visNodes: VisNode[] = graph.nodes.map(n => ({
          id:    n.id,
          label: n.label,
          group: n.group,
          color: this.groupColors[n.group]
        }));
        this.nodesDS = new DataSet<VisNode>(visNodes);

        const rawEdges = graph.edges;
        const seen = new Set<string>();
        type EdgeWithArrows = GraphEdge & { arrows?: { to: boolean; from?: boolean } };
        const processedEdges: EdgeWithArrows[] = [];
        for (const e of rawEdges) {
          // clave invariante al orden, e.g. "681_683"
          const key = e.from < e.to
            ? `${e.from}_${e.to}`
            : `${e.to}_${e.from}`;

          if (seen.has(key)) {
            // ya procesamos este par inverso
            continue;
          }

          // buscamos la arista inversa
          const rev = rawEdges.find(r => r.from === e.to && r.to === e.from);

          if (rev) {
            // la fusionamos en una sola arista bidireccional
            processedEdges.push({
              id:    e.id,      // o e.id+rev.id, como prefieras
              from:  e.from,
              to:    e.to,
              label: e.label,
              arrows: { to: true, from: true }
            });
          } else {
            // sólo una dirección
            processedEdges.push({
              ...e,
              arrows: { to: true }
            });
          }

          seen.add(key);
        }
        this.edgesDS = new DataSet<VisEdge>(processedEdges);

        const options = {
          layout: { improvedLayout: true },
          physics: {
            enabled: true,
            solver: 'barnesHut',
            barnesHut: {
              gravitationalConstant: -2000,
              centralGravity: 0.3,
              springLength: 200,
              springConstant: 0.05,
              damping: 0.09
            },
            stabilization: { enabled: true, iterations: 1000, updateInterval: 25 }
          },
          nodes: {
            shape: 'dot',
            size: 20,
            margin: { top:10, right:10, bottom:10, left:10 }
          },
          edges: {
            arrows: {
              to:   { enabled: true },
              from: { enabled: true }
            },
            font: { align: 'horizontal' }
          }
        };

        this.network = new Network(
          this.graphContainer.nativeElement,
          { nodes: this.nodesDS, edges: this.edgesDS },
          options
        );

        // 2) Colocación automática de la nave
        this.api.autoPlaceShip().subscribe(p => {
          this.shipPlacement = p;
          this.placement      = { ...p };   // copia inicial
          this.currentFuel    = p.fuel;     // ¡UNA SOLA VEZ!
          this.shipNodeId     = p.nodeId;
          this.highlightShipNode(p.nodeId);
          this.selectedDestination = this.graphNodes[0]?.id;
        });
      });
    });
  }

  showRoute() {
    if (!this.shipPlacement || this.selectedDestination == null) return;
    this.api.getRoute(
      this.shipPlacement.shipId,
      this.shipPlacement.nodeId,
      this.selectedDestination
    ).subscribe({
      next: route => this.animateRoute(route),
      error: err => {
        console.error(err);
        this.errorMessage = 'Error al calcular la ruta: ' + err.error;
      }
    });
  }

  private highlightShipNode(nodeId: number) {
    const orig = this.graphNodes.find(n => n.id === nodeId)!;
    if (this.shipPlacement) {
      this.shipPlacement.nodeId = nodeId;
      this.shipPlacement.label  = orig.label;        // ← actualiza aquí
      this.placement            = { ...this.shipPlacement };
    }

    // actualiza etiqueta en el recuadro de info
    if (this.placement) {
      this.placement.label = orig.label;

    }


    // actualiza nodo en el grafo
    this.nodesDS.update({
      id:    nodeId,
      label: `${orig.label} 🚀`,
      color: { background: 'yellow', border: 'orange' },
      size:  30
    });

    this.network.selectNodes([nodeId]);
    this.network.focus(nodeId, { scale: 1.2, animation: true });
  }

  private resetNode(nodeId: number) {
    const orig = this.graphNodes.find(n => n.id === nodeId)!;
    this.nodesDS.update({
      id:    nodeId,
      label: orig.label,
      color: this.groupColors[orig.group],
      size:  20
    });
  }

  private animateRoute(route: RouteStep[]) {
    // guarda el nodo anterior para colorear la arista
    let prevNode: number | null = null;

    // limpia estilos previos
    this.nodesDS.get().forEach(n => this.resetNode(n.id));
    this.edgesDS.get().forEach(e =>
      this.edgesDS.update({ id: e.id, color: { color: '#ccc' } })
    );

    route.forEach((step, idx) => {
      setTimeout(() => {
        // 1) En el primer paso (idx===0) sólo inicializamos prevNode y la posición
        if (idx === 0) {
          prevNode = step.node_id;
          this.shipNodeId = step.node_id;
          this.highlightShipNode(step.node_id);
          return;
        }

        // 2) A partir del segundo paso, descontar combustible y colorear la arista
        this.currentFuel = step.fuel_restante;
        const currentNode = this.graphNodes.find(n => n.id === step.node_id);


        // resetear el nodo anterior
        if (this.shipNodeId != null) {
          this.resetNode(this.shipNodeId);
        }

        // colorear la arista entre prevNode → step.node_id
        if (prevNode !== null) {
          const e = this.edgesDS.get({
            filter: x => x.from === prevNode && x.to === step.node_id
          })[0];
          if (e) {
            this.edgesDS.update({ id: e.id, color: { color: 'purple' } });
          }
        }

        // mover la nave, guardar para el siguiente ciclo y resaltar
        this.shipNodeId = step.node_id;
        this.highlightShipNode(step.node_id);
        prevNode = step.node_id;
        if (idx === route.length - 1 && this.shipPlacement) {
          this.api
            .updateFuel(this.shipPlacement.shipId, this.currentFuel!)
            .subscribe({
              next: () => console.log('Combustible actualizado en el servidor'),
              error: err => {
                console.error(err)
                this.errorMessage = 'Error al guardar combustible: ' + err.error;
              }
            });
        }
        if (currentNode?.group === 'station') {
          // recargamos al máximo usando el fuel original de la nave
          this.currentFuel = Number(this.currentFuel) + 100;
          this.api
          .updateFuel(this.shipPlacement!.shipId, this.currentFuel)
          .subscribe({
            next: () => console.log('Recarga persistida en BD'),
            error: e => this.errorMessage = 'Error al recargar en servidor: ' + e.error
          });
        }
      }, idx * 600);
    });
  }
}
