var cpjax = require('cpjax'),
    EventEmitter = require('events'),
    app = new EventEmitter(),
    lenze = require('../../')(app, {
        changeInterval: 16,
        send: function(data){
            console.log(data);
            self.postMessage(data);
        },
        receive: function(callback){
            self.addEventListener('message', function(message){
                console.log(message.data);
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

cpjax({
    url: 'users.json',
    dataType: 'json'
}, function(error, data){
    if(error){
        return;
    }

    app.users = data.map(function(user){
        user.logName = function(){
            console.log(user.name);
        };
        user.dob = new Date(1930 + (Math.random() * 90), 1, 1);
        return user;
    });

    updateUsers();
});