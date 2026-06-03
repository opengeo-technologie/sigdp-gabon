import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";

declare var M: any;

@Component({
  selector: "app-licence-autorisation-form",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./licence-autorisation-form.component.html",
  styleUrl: "./licence-autorisation-form.component.scss",
})
export class LicenceAutorisationFormComponent implements OnInit {
  ngOnInit() {
    this.initializeMaterialize();
  }

  private initializeMaterialize() {
    if (typeof M === "undefined") {
      console.error("Materialize not loaded");
      return;
    }

    setTimeout(() => {
      const selects = document.querySelectorAll("select");
      M.FormSelect.init(selects, {});

      // const textareas = document.querySelectorAll("textarea");
      // M.textareaAutoResize(textareas);
      M.updateTextFields();
    }, 500);
  }
}
