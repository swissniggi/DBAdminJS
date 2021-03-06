/* global kijs, this */

// --------------------------------------------------------------
// dbadmin.App
// --------------------------------------------------------------

dbadmin.App = class dbadmin_App {
    // --------------------------------------------------------------
    // CONSTRUCTOR
    // --------------------------------------------------------------
    constructor(config={}) {

        this._actionWindow = null;
        this._databaseView = null;
        this._loginWindow = null;
        this._selectWindow = null,
        this._viewport = null;

        // RPC-Instanz
        var rpcConfig = {};
        if (config.ajaxUrl) {
            rpcConfig.url = config.ajaxUrl;
        }
        this._rpc = new kijs.gui.Rpc(rpcConfig);
    }


    // --------------------------------------------------------------
    // MEMBERS
    // --------------------------------------------------------------
    /**
     * Hauptpanel erstellen
     * @returns {kijs.gui.Panel}
     */
    createMainPanel() {
        // Panel definieren
        return new kijs.gui.Panel({
            name: 'mainPanel',
            caption: 'DBAdmin',
            footerCaption: '&copy; 2018 by Nicolas Burgunder',
            cls: 'kijs-flexrow',
            style:{
                flex: 1
            },
            elements:[
                this._databaseView
            ],
            headerBarElements:[
                {
                    xtype: 'kijs.gui.Button',
                    name: 'btnLogout',
                    iconChar: '&#xf011',
                    toolTip: 'ausloggen',
                    style:{
                        marginRight: '6px',
                        display: 'flex',
                        flexDirection: 'row-reverse'
                    },
                    on:{
                        click: this._onBtnLogoutClick,
                        context: this
                    }
                }
            ],
            headerElements:[
                {
                    xtype: 'kijs.gui.Button',
                    name: 'btnCreate',
                    iconChar: '&#xf067',
                    toolTip: 'leere Datenbank erstellen',
                    on:{
                        click: this._onBtnCreateClick,
                        context: this
                    }
                },{
                    xtype: 'kijs.gui.Button',
                    name: 'btnDelete',
                    iconChar: '&#xf1f8',
                    toolTip: 'selektierte Datenbank löschen',
                    on:{
                        click: this._onBtnDeleteClick,
                        context: this
                    }
                },{
                    xtype: 'kijs.gui.Button',
                    name: 'btnImport',
                    iconChar: '&#xf019',
                    toolTip: 'Dump in selektierte Datenbank importieren',
                    on:{
                        click: this._onBtnImportClick,
                        context: this
                    }
                },{
                    xtype: 'kijs.gui.Button',
                    name: 'btnExport',
                    iconChar: '&#xf093',
                    toolTip: 'Dump von selektierter Datenbank erstellen',
                    on:{
                        click: this._onBtnExportClick,
                        context: this
                    }
                },{
                    xtype: 'kijs.gui.Button',
                    name: 'btnDuplicate',
                    iconChar: '&#xf0c5',
                    toolTip: 'selektierte Datenbank duplizieren',
                    on:{
                        click: this._onBtnDuplicateClick,
                        context: this
                    }
                },{
                    xtype: 'kijs.gui.Button',
                    name: 'btnRename',
                    iconChar: '&#xf044',
                    toolTip: 'selektierte Datenbank umbenennen',
                    on:{
                        click: this._onBtnRenameClick,
                        context: this
                    }
                }
            ]
        });
    }
    
    
    /**
     * App ausführen
     * @returns {undefined}
     */
    run() {
        this._databaseView = new dbadmin.DatabaseView({
            rpc: this._rpc
        });

        const mainPanel = this.createMainPanel();

        // ViewPort erstellen
        this._viewport = new kijs.gui.ViewPort({
            cls: 'kijs-flexcolumn',
            elements:[
                mainPanel
            ]
        });
        
        this._viewport.render();

        // feststellen ob ein Benutzer angemeldet ist
        this._rpc.do('dbadmin.checkLogin', null, 
        function(response) {
            if (response.data.username !== false) {
                sessionStorage.setItem('Benutzer', response.data.username);

                // Caption des Logout-Buttons setzen
                let caption = 'angemeldet als ' + sessionStorage.getItem('Benutzer') + '&nbsp;';
                mainPanel.headerBar.down('btnLogout').caption = caption;

                this._databaseView.load();
            } else {
                this.showLoginWindow();
            }
        }, this, false, this._viewport, 'dom', false);
    }


    /**
     * Action-Fenster erstellen
     * @param {string} action
     * @returns {undefined}
     */
    showActionWindow(action) {
        let caption = '';
        let iconChar = '';
        let value = '';
        let data = {};

        let oldDbName = '';
        if (this._databaseView.getSelected() !== null) {
            oldDbName = this._databaseView.getSelected().dataRow['Datenbankname'];
        }

        switch (action) {
            case 'create':
                caption = 'Neue Datenbank erstellen';
                iconChar = '&#xf067';
                break;
                
            case 'duplicate':
                caption = 'Datenbank duplizieren';
                iconChar = '&#xf0c5';
                data.oldDbName = oldDbName;
                value = oldDbName;
                break;
                
            case 'rename':
                caption = 'Datenbank umbenennen';
                iconChar = '&#xf044';
                data.oldDbName = oldDbName;
                value = oldDbName;
                break;
        }
        
        // Create-Window erstellen
        this._actionWindow = new dbadmin.ActionWindow({
            caption: caption,
            iconChar: iconChar,
            data: data,
            value: value,
            rpc: this._rpc,
            facadeFnSave: 'dbadmin.'+action,
            on:{
                afterSave: this._onActionWindowAfterSave,
                context: this
            }
        });

        let username = sessionStorage.getItem('Benutzer');
        
        if (action !== 'rename' && action !== 'duplicate') {
            this._actionWindow.down('newDbName').value = username;
        }
        this._actionWindow.show();
    }


    /**
     * Login-Fenster erstellen
     * @returns {undefined}
     */
    showLoginWindow() {
        // Window erstellen
        this._loginWindow = new dbadmin.LoginWindow({
            rpc: this._rpc,
            facadeFnSave: 'dbadmin.login',
            on:{
                afterSave: this._onLoginWindowAfterSave,
                context: this
            }
        });
        this._loginWindow.show();
    }


    /**
     * Select-Fenster erstellen
     * @returns {undefined}
     */
    showSelectWindow() {
        const data = {
            database: this._databaseView.getSelected().dataRow['Datenbankname'],
            numberOfTables: this._databaseView.getSelected().dataRow['AnzahlTabellen']
        };

        // Window erstellen
        this._selectWindow = new dbadmin.SelectWindow({
            caption: 'Dumps',
            rpcFormPanel: this._rpc,
            rpcComboField: this._rpc,
            facadeFnSave: 'dbadmin.import',
            facadeFnLoad: 'dbadmin.loadDumps',
            data: data,
            on:{
                afterSave: this._onSelectWindowAfterSave,
                context: this
            }
        });
        this._selectWindow.show();
    }


    // LISTENERS
    _onBtnCreateClick(e) {
        this.showActionWindow('create');
    }

    _onBtnDeleteClick(e) {
        if (this._databaseView.getSelected() === null) {
            kijs.gui.MsgBox.alert('Achtung','Keine Datenbank ausgewählt!');
        } else {
            kijs.gui.MsgBox.confirm('Wirklich löschen?','Willst du die Datenbank wirklich löschen?', function(e) {
                if (e.btn === 'yes') {
                    this._rpc.do('dbadmin.delete', this._databaseView.getSelected().dataRow, 
                    function(response) {
                        if (response.data.success === 'true') {
                            kijs.gui.CornerTipContainer.show('Info', 'Datenbank erfolgreich gelöscht.', 'info');
                            this._databaseView.load();
                        } else {
                            kijs.gui.MsgBox.error('Fehler', response.errorMsg);
                        }
                    }, this, false, this._viewport, 'dom', false);
                }
            }, this);
        }
    }
    
    _onBtnDuplicateClick(e) {
        if (this._databaseView.getSelected() === null) {
            kijs.gui.MsgBox.alert('Achtung','Keine Datenbank ausgewählt!');
        } else {
            this.showActionWindow('duplicate');
        }
    }
    
    _onBtnExportClick(e) {
        if (this._databaseView.getSelected() === null) {
            kijs.gui.MsgBox.alert('Achtung','Keine Datenbank ausgewählt!');
        } else {
            kijs.gui.MsgBox.confirm('Wirklich exportieren?', 'Willst du die Datenbank wirklich exportieren?', function(e) {
                if (e.btn === 'yes') {
                    this._rpc.do('dbadmin.export', this._databaseView.getSelected().dataRow, 
                    function(response) {
                        if (response.data.success === 'true') {
                            kijs.gui.CornerTipContainer.show('Info', 'Datenbank erfolgreich exportiert.', 'info');
                            this._databaseView.load();
                        } else {
                            kijs.gui.MsgBox.error('Fehler', response.errorMsg);
                        }
                    }, this, false, this._viewport, 'dom', false);
                }
            }, this);
        }
    }

    _onBtnImportClick(e) {
        if (this._databaseView.getSelected() === null) {
            kijs.gui.MsgBox.alert('Achtung','Keine Datenbank ausgewählt!');
        } else {
            this.showSelectWindow();
        }
    }

    _onBtnLogoutClick(e) {
        sessionStorage.clear();
        this._rpc.do('dbadmin.logout', null, 
        function() {
            kijs.gui.CornerTipContainer.show('Info', 'Du wurdest erfolgreich ausgelogt.', 'info');
            this.showLoginWindow();
            // DataView leeren
            this._databaseView.data = {};
            this._viewport.down('mainPanel').headerBar.down('btnLogout').caption = '';
        }, this, false, this._viewport, 'dom', false);
    }
    
    _onBtnRenameClick(e) {
        if (this._databaseView.getSelected() === null) {
            kijs.gui.MsgBox.alert('Achtung','Keine Datenbank ausgewählt!');
        } else {
            this.showActionWindow('rename');
        }
    }


    _onActionWindowAfterSave(e) {
        let txt = '';
        switch(e.raiseElement.facadeFnSave) {
            case 'dbadmin.create': txt = 'erstellt.'; break;
            case 'dbadmin.duplicate': txt = 'dupliziert.'; break
            case 'dbadmin.rename': txt = 'umbenannt.'; break;
        }
         
        kijs.gui.CornerTipContainer.show('Info', 'Datenbank erfolgreich '+txt, 'info');
        this._actionWindow.destruct();
        
        this._databaseView.load();
    }

    _onLoginWindowAfterSave(e) {
        this._databaseView.load();
        
        let username = this._loginWindow.down('username').value;
        sessionStorage.setItem('Benutzer', username);

        let caption = 'angemeldet als ' + username + '&nbsp;';
        this._viewport.down('mainPanel').headerBar.down('btnLogout').caption = caption;

        this._loginWindow.destruct();
    }

    _onSelectWindowAfterSave(e) {
        kijs.gui.CornerTipContainer.show('Info', 'Dump erfolgreich importiert.', 'info');
        this._selectWindow.destruct();
        
        this._databaseView.load();
    }
};
