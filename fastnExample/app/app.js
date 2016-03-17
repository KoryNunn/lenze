var cpjax = require('cpjax'),
    EventEmitter = require('events'),
    app = new EventEmitter(),
    lenze = require('../../')(app, {
        changeInterval: 16,
        send: function(data){
            self.postMessage(data);
        },
        receive: function(callback){
            self.addEventListener('message', function(message){
                callback(message.data);
            });
        }
    });

function updateUsers(){
    app.visibleUsers = app.users && app.users.filter(function(user){
        return ~user.name.indexOf(app.search || '');
    });
};

app.setSearch = function(value){
    app.search = value;
    updateUsers();
};

app.setSelectedUser = function(user){
    app.selectedUser = user;
};

cpjax({
    url: 'users.json',
    dataType: 'json'
}, function(error, data){
    if(error){
        return;
    }

    app.users = data.map(function(user){
        user.setName = function(newName){
            user.name = newName;
            updateUsers();
        };
        user.dob = new Date(1930 + (Math.random() * 90), 1, 1);
        return user;
    });

    updateUsers();
});