import { Component } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { App, Platform, NavController, NavParams, ToastController, 
        ActionSheetController, Tabs,Events } from 'ionic-angular';
import BasePage from '../basepage';
import { FiresPage } from './fires';
import { ChatPage } from '../chat/chat';
import { FireService, GeneralService, ChatService, UserService } from '../../providers';
import { ViewChild, ElementRef } from '@angular/core';
import { TranslateService } from 'ng2-translate';
import { Camera } from '@ionic-native/camera';
import { ImagePicker } from '@ionic-native/image-picker';
declare var google;

@Component({
  selector: 'page-fire',
  templateUrl: 'fire.html'
})
export class FirePage extends BasePage {
  public fire: any;
  public readonly: boolean;
  public isBrigade: boolean;
  @ViewChild('myTabs') tabRef: Tabs;
  tab1Root: any = FireViewPage;
  tab2Root: any= FireMapPage;

  constructor(public app: App, public platform: Platform,public events: Events,
    public navCtrl: NavController, public navParams: NavParams, public fireService: FireService,
     public toastCtrl: ToastController, public translateService: TranslateService,
    public generalService: GeneralService, public chatService: ChatService, public userService: UserService,
   
    public actionsheetCtrl: ActionSheetController) {
    super();

    if (this.navParams.get("fire")) {
      this.fire = this.navParams.get("fire");
      this.loadData();
    } else if (this.navParams.get("fireId")) {
      this.fire = { _id: this.navParams.get("fireId") };
      this.loadData();
    } else {
      FireService.data.fire=this.fire = {};
      FireService.data.readonly=this.readonly = false;
      this.events.publish('fire:loaded', this.fire, Date.now());
    }
  }


  loadData() {
    if (!this.fire) return;
    this.fireService.getFire(this.fire._id).then(d => {
      this.fire = d;

      if (this.fire.brigades) {
        let userId = this.currentUser()._id;
        let findUser = this.fire.brigades.find(b => {
          if (!b.brigades) return;
          let findUser = b.brigades.find(bu => {
            return userId == bu;
          })
          if (findUser) return true;
          return false;
        });
        if (findUser) this.isBrigade = true;
        else this.isBrigade = false;
      }
      else this.isBrigade = false;

      if (this.fire && this.isBrigade)
        this.readonly = false;
      else this.readonly = true;

      FireService.data.readonly=this.readonly;
      FireService.data.isBrigade=this.isBrigade;
      FireService.data.fire=this.fire;
      this.events.publish('fire:loaded', this.fire, Date.now());
      //this.tabRef.select(1);
    });
  }


  changeStatus(status) {
    this.fireService.doPut(`/fire/status/${this.fire._id}/${status}`).then(d => {
      this.showToast(this.translate("fire.status.updated"));
      this.loadData();
    });
  }

  openChat() {
    this.chatService.getChatByFire(this.fire).then((chat: any) => {
      if (!chat) return this.showToast(this.translate("chat.notfound"));
      this.navCtrl.push(ChatPage, { chat, chatId: chat._id });
    });
  }

  isInBrigade() {
    return this.isBrigade && this.fire._id != null;
  }

  isReadonly() {
    return this.readonly;
  }

  isTracking() {
    return FiresPage.isTracking;
  }

  tracking() {
    if (!FiresPage.isTracking) {
      let cb = (location) => {
        this.userService.saveLocation(location.latitude, location.longitude, this.fire._id);
        FiresPage.isTracking = true;
      };
      let errcb = () => {
        this.showToast(this.translate('error.notavailableweb'));
        FiresPage.isTracking = false;
      }
      FiresPage.isTracking = true;
      this.fireService.startTracking(cb, errcb);
    } else {
      FiresPage.isTracking = false;
      this.fireService.stopTracking();
    }
  }


  openMenu() {
    let buttons = [];

    let  addButton = (icon, text, cb) =>{
      buttons.push({
        text: this.translate(text),
        icon: !this.platform.is('ios') ? icon : null,
        handler: () => {
          cb();
        }
      });
    };

    if (this.fire.status == 'open') addButton('question', "fire.checking", () => { this.changeStatus('check') });
    if (this.fire.status == 'checking') addButton('checked', "fire.confirmed", () => { this.changeStatus('check') });
    if (this.fire.status == 'checking') addButton('marked', "fire.not_confirmed", () => { this.changeStatus('trash') });
    if (this.fire.status == 'confirmed') addButton('arrow-dropright-circle', "fire.startCombat", () => { this.changeStatus('trash') });
    if (this.fire.status == 'fighting' && this.isTracking() != true) addButton('arrow-dropright-circle', "fire.enterCombat", () => { this.tracking() });
    if (this.fire.status == 'fighting') addButton('checked', "fire.aftermath", () => { this.changeStatus('aftermath') });
    if (this.fire.status == 'aftermath') addButton('close', "fire.closeCombat", () => { this.changeStatus('finished') });
   // if (this.fire.status != 'finished') addButton('close', "chat.title", () => { this.openChat() });

    let actionSheet = this.actionsheetCtrl.create({
      title: 'Albums',
      cssClass: 'action-sheets-basic-page',
      buttons: [...buttons,
      {
        text: 'Cancel',
        role: 'cancel', // will always sort to be on the bottom
        icon: !this.platform.is('ios') ? 'close' : null,
        handler: () => {
          console.log('Cancel clicked');
        }
      }
      ]
    });
    actionSheet.present();
  }

}



/**
 * 
 * 
 * 
 * VIEW
 * 
 * 
 * 
 */
@Component({
  templateUrl: `fireview.html`
})
export class FireViewPage extends BasePage {
  public position: any;  @ViewChild('map') 
  mapElement: ElementRef;
  fireForm: FormGroup;
  fireFormFields: any;
  public image: any;
  fire: any;


  constructor(public fireService: FireService, public generalService: GeneralService, 
   public toastCtrl: ToastController,public events: Events, public translateService: TranslateService,
  public fb: FormBuilder, public camera: Camera, public imagePicker: ImagePicker){
    super();
        this.fireFormFields = {
      title: ['', [<any>Validators.required, <any>Validators.minLength(5)]],
      description: ['', [<any>Validators.required]],
      intensity: ['', [<any>Validators.required]]
    };
    this.ionViewDidLoad();

    events.subscribe('fire:loaded', (user, time) => {
       this.ionViewDidLoad();
    });
    
  }

  ionViewDidLoad() {
    if(!FireService.data.fire) this.fire =FireService.data.fire={}
    else this.fire = FireService.data.fire;
    this.fireForm = this.fb.group(this.fireFormFields);
    if(Object.keys(this.fire).length>0){
      this.setDataForm(this.fireForm, this.fireFormFields, FireService.data.fire);
    }
  }



  save() {
    if (!FireService.data.fire.coordinates) {
      return this.showToast(this.translate("fire.chooseLocation"));
    }
    if (FireService.data.fire._id) {
      FireService.data.fire = Object.assign(FireService.data.fire, this.fireForm.value);
      this.fireService.updateFire(FireService.data.fire).then(d => {
        FireService.data.fire = d;
        this.uploadPic();
        this.openPage(FiresPage);
      });
    } else {
      FireService.data.fire = Object.assign(FireService.data.fire, this.fireForm.value);
      this.fireService.addFire(FireService.data.fire).then(d => {
        FireService.data.fire = d;
        this.uploadPic();
        this.openPage(FiresPage);
      });
    }
  }

  isInBrigade() {
    return FireService.data.isBrigade && this.fire._id != null;
  }

  isReadonly() {
    return FireService.data.readonly;
  }

  getPic() {
    this.getPicture(d => { this.image = d; });
  }

  takePic() {
    this.takePicture(d => { this.image = d; });
  }

  getWebPic() {
    return (data) => {
      this.image = data;
    }
  }

  uploadPic() {
    if (!FireService.data.fire._id || !this.image) return;
    this.generalService.postFile("fire", FireService.data.fire._id, this.image).then(d => {
      FireService.data.fire = d;
    });
  }

}




/**
 * 
 * 
 * 
 * MAP
 * 
 * 
 */
@Component({
  template: `
  <ion-content><div #map id="map"></div></ion-content>`
})
export class FireMapPage extends BasePage {
  public position: any;  @ViewChild('map') 
  mapElement: ElementRef;
  constructor(public fireService: FireService, public generalService: GeneralService,
   public toastCtrl: ToastController, public translateService: TranslateService ){
    super();
     //FireService.data.readonly=this.readonly;
      //FireService.data.isBrigade=this.isBrigade;
  }

  ionViewDidLoad() {
    let cb = () => {
      if (FireService.data.fire && FireService.data.fire.coordinates) {
        let pos = { latitude: FireService.data.fire.coordinates[1], longitude: FireService.data.fire.coordinates[0] };
        this.loadMap(pos, {scrollwheel: false}, () => { this.confMap() });
        if (GeneralService.marker) this.generalService.removeElement(GeneralService.marker);
        GeneralService.marker = this.addMarker(pos, "Posição do Fogo");
      } else if (this.position) {
        this.loadMap(this.position, {scrollwheel: false}, () => { this.confMap(); });
      } else {
        this.loadMap(null, {scrollwheel: false}, () => { this.confMap(); });
      }
    }

    if (!this.position && !(FireService.data.fire && FireService.data.fire.coordinates)) {
      let addPosition = (pos) => {
        this.position = pos;
        cb();
      }
      this.generalService.getPosition(addPosition);
      setTimeout(function () { if (!GeneralService.map) this.initMap(); }, 10000);
    } else {
      cb();
    }
  }

  confMap() {
    if (this.isReadonly()) return;
    this.generalService.drawMarker(GeneralService.map, event => {
      if (GeneralService.marker) this.generalService.removeElement(GeneralService.marker);
      let latlng = this.generalService.getEventLatLng(event);

      FireService.data.fire.coordinates = [latlng.longitude, latlng.latitude];

      this.generalService.addMarker(GeneralService.map, latlng, "Posição do Fogo", m => {
        GeneralService.marker = m;
      });
    });
    this.getTracks(FireService.data.fire);
  }

  getTracks(fire) {
    if (!fire || !fire._id) return;
    let colors = this.generalService.colors();
    this.fireService.getTracks(fire._id).then((resp) => {
      let tracks = <any>resp;
      tracks.forEach((track, i) => {
        if (!track.line) return;

        let cindex = i;
        if (cindex > colors.length) cindex -= colors.length;
        let userColor = colors[cindex];

        this.generalService.addPolyline(GeneralService.map, track.line.coordinates, {
          strokeColor: userColor,
          fillColor: userColor,
          content: track.user.name
        });
      });
    })
  }

  /*

  findTransit() {
    var request = {
      location: this.currentLocation,
      radius: '5000',
      types: ['train_station']
    };

    // Create the PlaceService and send the request.
    // Handle the callback with an anonymous function.
    var service = new google.maps.places.PlacesService(GeneralService.map);
    service.nearbySearch(request, function (results, status) {
      if (status == google.maps.places.PlacesServiceStatus.OK) {
        for (var i = 0; i < results.length; i++) {
          var place = results[i];
          // If the request succeeds, draw the place location on
          // the map as a marker, and register an event to handle a
          // click on the marker.
          new google.maps.Marker({
            map: GeneralService.map,
            position: place.geometry.location
          });
        }
      }
    });
  }
  */
}
