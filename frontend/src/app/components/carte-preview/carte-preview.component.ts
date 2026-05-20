import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Pecheur } from '../../models/pecheur.model';
import { CardGeneratorService } from '../../services/card-generator.service';

@Component({
  selector: 'app-carte-preview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="carte-preview-container" *ngIf="pecheur">
      <div [innerHTML]="cardHTML" class="carte-content"></div>
      
      <div class="carte-actions" *ngIf="showActions">
        <button class="btn btn-small teal" (click)="onDownloadPNG()">
          <i class="material-icons left">download</i>
          PNG
        </button>
        <button class="btn btn-small blue" (click)="onDownloadPDF()">
          <i class="material-icons left">picture_as_pdf</i>
          PDF
        </button>
        <button class="btn btn-small orange" (click)="onPrint()">
          <i class="material-icons left">print</i>
          Imprimer
        </button>
      </div>
    </div>
  `,
  styles: [`
    .carte-preview-container {
      position: relative;
    }

    .carte-content {
      transform: scale(0.5);
      transform-origin: top left;
      width: 2022px;
      height: 1276px;
    }

    .carte-actions {
      margin-top: 1rem;
      text-align: center;
      display: flex;
      gap: 0.5rem;
      justify-content: center;
    }

    .carte-actions button {
      margin: 0;
    }
  `]
})
export class CartePreviewComponent implements OnInit {
  @Input() pecheur!: Pecheur;
  @Input() photoUrl?: string;
  @Input() showActions = true;

  cardHTML = '';
  qrCodeUrl = '';

  constructor(private cardGeneratorService: CardGeneratorService) {}

  async ngOnInit() {
    if (this.pecheur) {
      await this.generatePreview();
    }
  }

  async generatePreview() {
    try {
      this.qrCodeUrl = await this.cardGeneratorService.generateQRCode(this.pecheur);
      this.cardHTML = this.cardGeneratorService.generateCardHTML(
        this.pecheur,
        this.qrCodeUrl,
        this.photoUrl
      );
    } catch (error) {
      console.error('Erreur génération aperçu:', error);
    }
  }

  async onDownloadPNG() {
    try {
      await this.cardGeneratorService.downloadCardPNG(this.pecheur, this.photoUrl);
    } catch (error) {
      console.error('Erreur téléchargement PNG:', error);
    }
  }

  async onDownloadPDF() {
    try {
      await this.cardGeneratorService.generateCardPDF(this.pecheur, this.photoUrl);
    } catch (error) {
      console.error('Erreur génération PDF:', error);
    }
  }

  async onPrint() {
    try {
      await this.cardGeneratorService.printCard(this.pecheur, this.photoUrl);
    } catch (error) {
      console.error('Erreur impression:', error);
    }
  }
}
