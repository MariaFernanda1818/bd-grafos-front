import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { HttpClientModule } from "@angular/common/http";
import { AppComponent } from "./app.component";
import { ApiService } from "./api.service";
import { FormsModule } from "@angular/forms";

@NgModule({
    declarations: [AppComponent],
    imports: [
        BrowserModule,
        HttpClientModule,
        FormsModule
    ],
    bootstrap: [AppComponent]
})
export class AppModule {}
